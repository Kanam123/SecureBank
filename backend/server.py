"""SecureBank API — FastAPI + MongoDB (Motor) backend.

Implements the same /api contract the React frontend already consumes:
auth (JWT + bcrypt), accounts, transactions (deposit/withdraw/transfer),
analytics, beneficiaries, fraud detection, and an admin console with RBAC.
"""
import os
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

import bcrypt
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, Header, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")
JWT_ALG = "HS256"
JWT_EXPIRES_DAYS = 7

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="SecureBank API")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=(os.environ.get("CORS_ORIGINS", "*").split(",")),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- error handling: frontend reads response.data.message ----------
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"message": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    errs = exc.errors()
    msg = errs[0].get("msg", "Invalid request") if errs else "Invalid request"
    return JSONResponse(status_code=400, content={"message": msg})


# ---------- helpers ----------
def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))
    except Exception:
        return False


def make_token(user) -> str:
    payload = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def iso(dt):
    if isinstance(dt, datetime):
        return dt.isoformat()
    return dt


def user_out(u):
    return {
        "id": str(u["_id"]),
        "name": u.get("name", ""),
        "email": u.get("email", ""),
        "role": u.get("role", "user"),
        "phone": u.get("phone", ""),
        "address": u.get("address", ""),
        "status": u.get("status", "active"),
        "createdAt": iso(u.get("createdAt")),
        "updatedAt": iso(u.get("updatedAt", u.get("createdAt"))),
    }


def account_out(a):
    return {
        "id": str(a["_id"]),
        "userId": str(a["userId"]),
        "accountNumber": a["accountNumber"],
        "accountType": a.get("accountType", "savings"),
        "balance": round(a.get("balance", 0), 2),
        "status": a.get("status", "active"),
        "createdAt": iso(a.get("createdAt")),
    }


def txn_out(t):
    return {
        "id": str(t["_id"]),
        "type": t["type"],
        "amount": round(t["amount"], 2),
        "balanceAfter": round(t["balanceAfter"], 2),
        "description": t.get("description", ""),
        "counterpartyAccount": t.get("counterpartyAccount", ""),
        "counterpartyName": t.get("counterpartyName", ""),
        "status": t.get("status", "completed"),
        "riskLevel": t.get("riskLevel", "LOW"),
        "flagged": t.get("flagged", False),
        "fraudReasons": t.get("fraudReasons", []),
        "accountNumber": t.get("accountNumber", ""),
        "createdAt": iso(t.get("createdAt")),
    }


def ben_out(b):
    return {
        "id": str(b["_id"]),
        "name": b["name"],
        "accountNumber": b["accountNumber"],
        "nickname": b.get("nickname", ""),
        "bankName": b.get("bankName", "SecureBank"),
    }


def oid(value):
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


async def gen_account_number() -> str:
    for _ in range(15):
        num = str(random.randint(100000000000, 999999999999))
        if not await db.accounts.find_one({"accountNumber": num}):
            return num
    raise HTTPException(500, "Failed to generate account number")


async def assess_risk(user_id: str, amount: float, balance_before: float, ttype: str):
    reasons, score = [], 0
    if amount >= 100000:
        score += 4
        reasons.append("Unusually large transaction (₹1,00,000 or more)")
    elif amount >= 50000:
        score += 2
        reasons.append("Large transaction (₹50,000 or more)")
    if ttype in ("withdraw", "transfer_out") and balance_before > 0 and amount > 0.8 * balance_before:
        score += 2
        reasons.append("Transaction drains over 80% of available balance")
    since = datetime.now(timezone.utc) - timedelta(seconds=60)
    recent = await db.transactions.count_documents({"userId": user_id, "createdAt": {"$gte": since}})
    if recent >= 3:
        score += 2
        reasons.append("Multiple rapid transactions detected in a short window")
    level = "HIGH" if score >= 4 else "MEDIUM" if score >= 2 else "LOW"
    return level, level != "LOW", reasons


# ---------- auth dependencies ----------
async def current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    _id = oid(payload.get("sub"))
    if not _id:
        raise HTTPException(401, "Invalid token")
    u = await db.users.find_one({"_id": _id})
    if not u:
        raise HTTPException(401, "User not found")
    if u.get("status") == "suspended":
        raise HTTPException(403, "Your account has been suspended")
    return u


async def current_admin(u=Depends(current_user)):
    if u.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return u


# ---------- request bodies ----------
class RegisterBody(BaseModel):
    name: str
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str


class ProfileBody(BaseModel):
    name: str | None = None
    phone: str | None = None
    address: str | None = None


class AccountBody(BaseModel):
    accountType: str | None = "savings"


class MoneyBody(BaseModel):
    accountId: str
    amount: float
    description: str | None = ""


class TransferBody(BaseModel):
    fromAccountId: str
    toAccountNumber: str
    amount: float
    description: str | None = ""


class BeneficiaryBody(BaseModel):
    name: str
    accountNumber: str
    nickname: str | None = ""


class AdminUserBody(BaseModel):
    role: str | None = None
    status: str | None = None


# ---------- health ----------
@api.get("/")
async def root():
    return {"message": "SecureBank API is running"}


@api.get("/health")
async def health():
    return {"status": "ok"}


# ---------- auth ----------
@api.post("/auth/register")
async def register(body: RegisterBody):
    name = (body.name or "").strip()
    email = (body.email or "").strip().lower()
    if not name or not email or not body.password:
        raise HTTPException(400, "Name, email and password are required")
    if "@" not in email or "." not in email:
        raise HTTPException(400, "Please enter a valid email address")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "An account with this email already exists")
    now = datetime.now(timezone.utc)
    doc = {
        "name": name, "email": email, "passwordHash": hash_pw(body.password),
        "role": "user", "phone": "", "address": "", "status": "active",
        "createdAt": now, "updatedAt": now,
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    await db.accounts.insert_one({
        "userId": str(res.inserted_id), "accountNumber": await gen_account_number(),
        "accountType": "savings", "balance": 0.0, "status": "active", "createdAt": now,
    })
    return {"token": make_token(doc), "user": user_out(doc)}


@api.post("/auth/login")
async def login(body: LoginBody):
    email = (body.email or "").strip().lower()
    if not email or not body.password:
        raise HTTPException(400, "Email and password are required")
    u = await db.users.find_one({"email": email})
    if not u or not verify_pw(body.password, u["passwordHash"]):
        raise HTTPException(401, "Invalid email or password")
    if u.get("status") == "suspended":
        raise HTTPException(403, "Your account has been suspended")
    return {"token": make_token(u), "user": user_out(u)}


@api.get("/auth/me")
async def me(u=Depends(current_user)):
    return {"user": user_out(u)}


# ---------- users ----------
@api.get("/users/profile")
async def get_profile(u=Depends(current_user)):
    return {"user": user_out(u)}


@api.put("/users/profile")
async def update_profile(body: ProfileBody, u=Depends(current_user)):
    updates = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.phone is not None:
        updates["phone"] = body.phone.strip()
    if body.address is not None:
        updates["address"] = body.address.strip()
    updates["updatedAt"] = datetime.now(timezone.utc)
    await db.users.update_one({"_id": u["_id"]}, {"$set": updates})
    u = await db.users.find_one({"_id": u["_id"]})
    return {"user": user_out(u)}


# ---------- accounts ----------
@api.post("/accounts")
async def create_account(body: AccountBody, u=Depends(current_user)):
    atype = body.accountType if body.accountType in ("savings", "current") else "savings"
    doc = {
        "userId": str(u["_id"]), "accountNumber": await gen_account_number(),
        "accountType": atype, "balance": 0.0, "status": "active",
        "createdAt": datetime.now(timezone.utc),
    }
    res = await db.accounts.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"account": account_out(doc)}


@api.get("/accounts")
async def list_accounts(u=Depends(current_user)):
    accts = await db.accounts.find({"userId": str(u["_id"])}).sort("createdAt", 1).to_list(100)
    return {"accounts": [account_out(a) for a in accts]}


@api.get("/accounts/{account_id}")
async def get_account(account_id: str, u=Depends(current_user)):
    a = await db.accounts.find_one({"_id": oid(account_id)}) if oid(account_id) else None
    if not a:
        raise HTTPException(404, "Account not found")
    if a["userId"] != str(u["_id"]):
        raise HTTPException(403, "You do not have access to this account")
    return {"account": account_out(a)}


@api.get("/accounts/{account_id}/balance")
async def get_balance(account_id: str, u=Depends(current_user)):
    a = await db.accounts.find_one({"_id": oid(account_id)}) if oid(account_id) else None
    if not a:
        raise HTTPException(404, "Account not found")
    if a["userId"] != str(u["_id"]):
        raise HTTPException(403, "You do not have access to this account")
    return {"balance": round(a["balance"], 2), "accountNumber": a["accountNumber"]}


async def _owned_account(account_id, user_id):
    _id = oid(account_id)
    if not _id:
        return None, None
    a = await db.accounts.find_one({"_id": _id})
    if not a:
        return None, None
    if a["userId"] != user_id:
        return None, "forbidden"
    return a, None


# ---------- transactions ----------
@api.post("/transactions/deposit")
async def deposit(body: MoneyBody, u=Depends(current_user)):
    amt = round(float(body.amount or 0), 2)
    if amt <= 0:
        raise HTTPException(400, "Enter a valid amount greater than zero")
    a, err = await _owned_account(body.accountId, str(u["_id"]))
    if err == "forbidden":
        raise HTTPException(403, "You do not have access to this account")
    if not a:
        raise HTTPException(404, "Account not found")
    level, flagged, reasons = await assess_risk(str(u["_id"]), amt, a["balance"], "deposit")
    new_balance = round(a["balance"] + amt, 2)
    await db.accounts.update_one({"_id": a["_id"]}, {"$set": {"balance": new_balance}})
    doc = {
        "userId": str(u["_id"]), "accountId": str(a["_id"]), "accountNumber": a["accountNumber"],
        "type": "deposit", "amount": amt, "balanceAfter": new_balance,
        "description": body.description or "Cash deposit", "counterpartyAccount": "", "counterpartyName": "",
        "status": "completed", "riskLevel": level, "flagged": flagged, "fraudReasons": reasons,
        "createdAt": datetime.now(timezone.utc),
    }
    res = await db.transactions.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"transaction": txn_out(doc), "balance": new_balance}


@api.post("/transactions/withdraw")
async def withdraw(body: MoneyBody, u=Depends(current_user)):
    amt = round(float(body.amount or 0), 2)
    if amt <= 0:
        raise HTTPException(400, "Enter a valid amount greater than zero")
    a, err = await _owned_account(body.accountId, str(u["_id"]))
    if err == "forbidden":
        raise HTTPException(403, "You do not have access to this account")
    if not a:
        raise HTTPException(404, "Account not found")
    if amt > a["balance"]:
        raise HTTPException(400, "Insufficient balance")
    level, flagged, reasons = await assess_risk(str(u["_id"]), amt, a["balance"], "withdraw")
    new_balance = round(a["balance"] - amt, 2)
    await db.accounts.update_one({"_id": a["_id"]}, {"$set": {"balance": new_balance}})
    doc = {
        "userId": str(u["_id"]), "accountId": str(a["_id"]), "accountNumber": a["accountNumber"],
        "type": "withdraw", "amount": amt, "balanceAfter": new_balance,
        "description": body.description or "Cash withdrawal", "counterpartyAccount": "", "counterpartyName": "",
        "status": "completed", "riskLevel": level, "flagged": flagged, "fraudReasons": reasons,
        "createdAt": datetime.now(timezone.utc),
    }
    res = await db.transactions.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"transaction": txn_out(doc), "balance": new_balance}


@api.post("/transactions/transfer")
async def transfer(body: TransferBody, u=Depends(current_user)):
    amt = round(float(body.amount or 0), 2)
    if amt <= 0:
        raise HTTPException(400, "Enter a valid amount greater than zero")
    if not body.toAccountNumber:
        raise HTTPException(400, "Recipient account number is required")
    src, err = await _owned_account(body.fromAccountId, str(u["_id"]))
    if err == "forbidden":
        raise HTTPException(403, "You do not have access to this account")
    if not src:
        raise HTTPException(404, "Source account not found")
    dst = await db.accounts.find_one({"accountNumber": str(body.toAccountNumber).strip()})
    if not dst:
        raise HTTPException(404, "Recipient account not found")
    if str(dst["_id"]) == str(src["_id"]):
        raise HTTPException(400, "Cannot transfer to the same account")
    if amt > src["balance"]:
        raise HTTPException(400, "Insufficient balance")

    sender = await db.users.find_one({"_id": oid(src["userId"])})
    receiver = await db.users.find_one({"_id": oid(dst["userId"])})
    level, flagged, reasons = await assess_risk(str(u["_id"]), amt, src["balance"], "transfer_out")

    src_balance = round(src["balance"] - amt, 2)
    dst_balance = round(dst["balance"] + amt, 2)
    await db.accounts.update_one({"_id": src["_id"]}, {"$set": {"balance": src_balance}})
    await db.accounts.update_one({"_id": dst["_id"]}, {"$set": {"balance": dst_balance}})

    now = datetime.now(timezone.utc)
    out_doc = {
        "userId": src["userId"], "accountId": str(src["_id"]), "accountNumber": src["accountNumber"],
        "type": "transfer_out", "amount": amt, "balanceAfter": src_balance,
        "description": body.description or "Fund transfer",
        "counterpartyAccount": dst["accountNumber"], "counterpartyName": receiver["name"] if receiver else "",
        "status": "completed", "riskLevel": level, "flagged": flagged, "fraudReasons": reasons, "createdAt": now,
    }
    res = await db.transactions.insert_one(out_doc)
    out_doc["_id"] = res.inserted_id
    await db.transactions.insert_one({
        "userId": dst["userId"], "accountId": str(dst["_id"]), "accountNumber": dst["accountNumber"],
        "type": "transfer_in", "amount": amt, "balanceAfter": dst_balance,
        "description": body.description or "Fund received",
        "counterpartyAccount": src["accountNumber"], "counterpartyName": sender["name"] if sender else "",
        "status": "completed", "riskLevel": "LOW", "flagged": False, "fraudReasons": [], "createdAt": now,
    })
    return {"transaction": txn_out(out_doc), "balance": src_balance}


@api.get("/transactions")
async def list_transactions(
    u=Depends(current_user),
    type: str | None = Query(None),
    q: str | None = Query(None),
    minAmount: float | None = Query(None),
    maxAmount: float | None = Query(None),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None),
    accountId: str | None = Query(None),
):
    query = {"userId": str(u["_id"])}
    if type and type != "all":
        query["type"] = type
    if accountId and oid(accountId):
        query["accountId"] = accountId
    if minAmount is not None or maxAmount is not None:
        query["amount"] = {}
        if minAmount is not None:
            query["amount"]["$gte"] = minAmount
        if maxAmount is not None:
            query["amount"]["$lte"] = maxAmount
    if from_ or to:
        rng = {}
        if from_:
            rng["$gte"] = datetime.fromisoformat(from_).replace(tzinfo=timezone.utc)
        if to:
            end = datetime.fromisoformat(to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            rng["$lte"] = end
        query["createdAt"] = rng
    if q:
        rx = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [
            {"description": rx}, {"counterpartyName": rx},
            {"counterpartyAccount": rx}, {"accountNumber": rx},
        ]
    txns = await db.transactions.find(query).sort("createdAt", -1).to_list(500)
    return {"transactions": [txn_out(t) for t in txns]}


@api.get("/transactions/analytics")
async def analytics(u=Depends(current_user)):
    uid = str(u["_id"])
    accts = await db.accounts.find({"userId": uid}).to_list(100)
    total_balance = round(sum(a["balance"] for a in accts), 2)
    txns = await db.transactions.find({"userId": uid}).to_list(10000)

    total_received = total_transferred = total_deposited = total_withdrawn = 0.0
    breakdown = {"deposit": 0.0, "withdraw": 0.0, "transfer_out": 0.0, "transfer_in": 0.0}
    for t in txns:
        breakdown[t["type"]] = breakdown.get(t["type"], 0.0) + t["amount"]
        if t["type"] == "transfer_in":
            total_received += t["amount"]
        elif t["type"] == "transfer_out":
            total_transferred += t["amount"]
        elif t["type"] == "deposit":
            total_deposited += t["amount"]
        elif t["type"] == "withdraw":
            total_withdrawn += t["amount"]

    now = datetime.now(timezone.utc)
    months, index = [], {}
    for i in range(5, -1, -1):
        y = now.year + (now.month - 1 - i) // 12
        m = (now.month - 1 - i) % 12
        key = f"{y}-{m}"
        index[key] = len(months)
        months.append({"label": datetime(y, m + 1, 1).strftime("%b"), "moneyIn": 0.0, "moneyOut": 0.0})
    for t in txns:
        d = t["createdAt"]
        if isinstance(d, str):
            d = datetime.fromisoformat(d)
        key = f"{d.year}-{d.month - 1}"
        if key in index:
            bucket = months[index[key]]
            if t["type"] in ("deposit", "transfer_in"):
                bucket["moneyIn"] += t["amount"]
            else:
                bucket["moneyOut"] += t["amount"]

    recent = await db.transactions.find({"userId": uid}).sort("createdAt", -1).to_list(6)
    flagged_count = await db.transactions.count_documents({"userId": uid, "flagged": True})

    return {
        "totalBalance": total_balance,
        "totalReceived": round(total_received, 2),
        "totalTransferred": round(total_transferred, 2),
        "totalDeposited": round(total_deposited, 2),
        "totalWithdrawn": round(total_withdrawn, 2),
        "transactionCount": len(txns),
        "flaggedCount": flagged_count,
        "accountsCount": len(accts),
        "typeBreakdown": [
            {"name": "Deposits", "value": round(breakdown["deposit"], 2)},
            {"name": "Withdrawals", "value": round(breakdown["withdraw"], 2)},
            {"name": "Sent", "value": round(breakdown["transfer_out"], 2)},
            {"name": "Received", "value": round(breakdown["transfer_in"], 2)},
        ],
        "monthlyTrend": [{"label": m["label"], "moneyIn": round(m["moneyIn"], 2), "moneyOut": round(m["moneyOut"], 2)} for m in months],
        "recentTransactions": [txn_out(t) for t in recent],
    }


# ---------- beneficiaries ----------
@api.get("/beneficiaries")
async def list_beneficiaries(u=Depends(current_user)):
    items = await db.beneficiaries.find({"userId": str(u["_id"])}).sort("createdAt", -1).to_list(200)
    return {"beneficiaries": [ben_out(b) for b in items]}


@api.post("/beneficiaries")
async def add_beneficiary(body: BeneficiaryBody, u=Depends(current_user)):
    if not body.name or not body.accountNumber:
        raise HTTPException(400, "Name and account number are required")
    acc = str(body.accountNumber).strip()
    target = await db.accounts.find_one({"accountNumber": acc})
    if not target:
        raise HTTPException(404, "No SecureBank account found with this number")
    if target["userId"] == str(u["_id"]):
        raise HTTPException(400, "You cannot add your own account as a beneficiary")
    if await db.beneficiaries.find_one({"userId": str(u["_id"]), "accountNumber": acc}):
        raise HTTPException(409, "This beneficiary is already saved")
    doc = {
        "userId": str(u["_id"]), "name": body.name.strip(), "accountNumber": acc,
        "nickname": (body.nickname or "").strip(), "bankName": "SecureBank",
        "createdAt": datetime.now(timezone.utc),
    }
    res = await db.beneficiaries.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"beneficiary": ben_out(doc)}


@api.delete("/beneficiaries/{ben_id}")
async def delete_beneficiary(ben_id: str, u=Depends(current_user)):
    b = await db.beneficiaries.find_one({"_id": oid(ben_id)}) if oid(ben_id) else None
    if not b:
        raise HTTPException(404, "Beneficiary not found")
    if b["userId"] != str(u["_id"]):
        raise HTTPException(403, "Not allowed")
    await db.beneficiaries.delete_one({"_id": b["_id"]})
    return {"message": "Beneficiary removed"}


# ---------- admin ----------
@api.get("/admin/stats")
async def admin_stats(_=Depends(current_admin)):
    user_count = await db.users.count_documents({"role": "user"})
    account_count = await db.accounts.count_documents({})
    txn_count = await db.transactions.count_documents({})
    flagged_count = await db.transactions.count_documents({"flagged": True})
    high_risk = await db.transactions.count_documents({"riskLevel": "HIGH"})
    accts_agg = await db.accounts.aggregate([{"$group": {"_id": None, "total": {"$sum": "$balance"}}}]).to_list(1)
    txns_agg = await db.transactions.aggregate([{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
    return {
        "userCount": user_count,
        "accountCount": account_count,
        "txnCount": txn_count,
        "flaggedCount": flagged_count,
        "highRisk": high_risk,
        "totalDeposits": round(accts_agg[0]["total"], 2) if accts_agg else 0,
        "totalVolume": round(txns_agg[0]["total"], 2) if txns_agg else 0,
    }


@api.get("/admin/users")
async def admin_users(_=Depends(current_admin), q: str | None = Query(None)):
    query = {}
    if q:
        rx = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [{"name": rx}, {"email": rx}]
    users = await db.users.find(query).sort("createdAt", -1).to_list(1000)
    accts = await db.accounts.find({}, {"userId": 1, "balance": 1}).to_list(5000)
    balances = {}
    for a in accts:
        key = str(a["userId"])
        balances[key] = balances.get(key, 0) + a["balance"]
    return {"users": [{**user_out(u), "totalBalance": round(balances.get(str(u["_id"]), 0), 2)} for u in users]}


@api.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUserBody, _=Depends(current_admin)):
    u = await db.users.find_one({"_id": oid(user_id)}) if oid(user_id) else None
    if not u:
        raise HTTPException(404, "User not found")
    updates = {}
    if body.role in ("user", "admin"):
        updates["role"] = body.role
    if body.status in ("active", "suspended"):
        updates["status"] = body.status
    if updates:
        await db.users.update_one({"_id": u["_id"]}, {"$set": updates})
        u = await db.users.find_one({"_id": u["_id"]})
    return {"user": user_out(u)}


async def _user_map():
    users = await db.users.find({}, {"name": 1, "email": 1}).to_list(5000)
    return {str(u["_id"]): u for u in users}


@api.get("/admin/accounts")
async def admin_accounts(_=Depends(current_admin)):
    accts = await db.accounts.find({}).sort("createdAt", -1).to_list(500)
    umap = await _user_map()
    out = []
    for a in accts:
        u = umap.get(str(a["userId"]))
        out.append({**account_out(a), "ownerName": u["name"] if u else "Unknown", "ownerEmail": u["email"] if u else ""})
    return {"accounts": out}


@api.get("/admin/transactions")
async def admin_transactions(_=Depends(current_admin), type: str | None = Query(None), riskLevel: str | None = Query(None)):
    query = {}
    if type and type != "all":
        query["type"] = type
    if riskLevel and riskLevel != "all":
        query["riskLevel"] = riskLevel
    txns = await db.transactions.find(query).sort("createdAt", -1).to_list(500)
    umap = await _user_map()
    out = []
    for t in txns:
        u = umap.get(str(t["userId"]))
        out.append({**txn_out(t), "ownerName": u["name"] if u else "Unknown", "ownerEmail": u["email"] if u else ""})
    return {"transactions": out}


@api.get("/admin/suspicious")
async def admin_suspicious(_=Depends(current_admin)):
    txns = await db.transactions.find({"flagged": True}).sort("createdAt", -1).to_list(500)
    umap = await _user_map()
    out = []
    for t in txns:
        u = umap.get(str(t["userId"]))
        out.append({**txn_out(t), "ownerName": u["name"] if u else "Unknown", "ownerEmail": u["email"] if u else ""})
    return {"transactions": out}


app.include_router(api)


# ---------- startup: indexes + seed ----------
async def ensure_user(name, email, password, role):
    email = email.lower()
    u = await db.users.find_one({"email": email})
    now = datetime.now(timezone.utc)
    if not u:
        doc = {
            "name": name, "email": email, "passwordHash": hash_pw(password), "role": role,
            "phone": "", "address": "", "status": "active", "createdAt": now, "updatedAt": now,
        }
        res = await db.users.insert_one(doc)
        doc["_id"] = res.inserted_id
        u = doc
    elif not verify_pw(password, u["passwordHash"]):
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"passwordHash": hash_pw(password), "role": role}})
        u = await db.users.find_one({"_id": u["_id"]})
    a = await db.accounts.find_one({"userId": str(u["_id"])})
    if not a:
        doc = {
            "userId": str(u["_id"]), "accountNumber": await gen_account_number(),
            "accountType": "savings", "balance": 0.0, "status": "active", "createdAt": now,
        }
        res = await db.accounts.insert_one(doc)
        doc["_id"] = res.inserted_id
        a = doc
    return u, a


async def record_seed_txn(u, a, ttype, amount, description, counter=None, force_risk=None, reasons=None):
    level, flagged, r = await assess_risk(str(u["_id"]), amount, a["balance"], ttype)
    if force_risk:
        level, flagged, r = force_risk, force_risk != "LOW", reasons or []
    if ttype in ("deposit", "transfer_in"):
        a["balance"] = round(a["balance"] + amount, 2)
    else:
        a["balance"] = round(a["balance"] - amount, 2)
    await db.accounts.update_one({"_id": a["_id"]}, {"$set": {"balance": a["balance"]}})
    await db.transactions.insert_one({
        "userId": str(u["_id"]), "accountId": str(a["_id"]), "accountNumber": a["accountNumber"],
        "type": ttype, "amount": amount, "balanceAfter": a["balance"], "description": description,
        "counterpartyAccount": counter["accountNumber"] if counter else "",
        "counterpartyName": counter["name"] if counter else "",
        "status": "completed", "riskLevel": level, "flagged": flagged, "fraudReasons": r,
        "createdAt": datetime.now(timezone.utc),
    })


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.accounts.create_index("accountNumber", unique=True)
    await db.transactions.create_index("userId")

    admin_u, admin_a = await ensure_user(
        os.environ.get("ADMIN_NAME", "Admin"),
        os.environ.get("ADMIN_EMAIL", "admin@example.com"),
        os.environ.get("ADMIN_PASSWORD", "admin123"), "admin",
    )
    demo_u, demo_a = await ensure_user(
        os.environ.get("DEMO_USER_NAME", "Demo User"),
        os.environ.get("DEMO_USER_EMAIL", "demo@securebank.com"),
        os.environ.get("DEMO_USER_PASSWORD", "User@12345"), "user",
    )

    if await db.transactions.count_documents({"userId": str(demo_u["_id"])}) == 0:
        await record_seed_txn(demo_u, demo_a, "deposit", 50000, "Salary credit")
        await record_seed_txn(demo_u, demo_a, "deposit", 12000, "Freelance payment")
        await record_seed_txn(demo_u, demo_a, "withdraw", 3500, "ATM withdrawal")
        await record_seed_txn(demo_u, demo_a, "transfer_out", 8000, "Rent payment",
                              counter={"accountNumber": admin_a["accountNumber"], "name": admin_u["name"]})
        await record_seed_txn(demo_u, demo_a, "deposit", 150000, "Property sale advance",
                              force_risk="HIGH", reasons=["Unusually large transaction (₹1,00,000 or more)"])
    print("[seed] Admin & demo user ready")
