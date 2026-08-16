"""SecureBank backend test suite - Node/Express + MongoDB API."""
import os
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "kanamkhushikumari1@gmail.com", "password": "Admin@12345"}
DEMO = {"email": "demo@securebank.com", "password": "User@12345"}


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


def _login(s, creds):
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    d = r.json()
    return d["token"], d["user"]


@pytest.fixture(scope="session")
def admin_auth(s):
    tok, user = _login(s, ADMIN)
    return {"token": tok, "user": user, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="session")
def demo_auth(s):
    tok, user = _login(s, DEMO)
    return {"token": tok, "user": user, "headers": {"Authorization": f"Bearer {tok}"}}


# ---------- module: health ----------
class TestHealth:
    def test_health(self, s):
        r = s.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------- module: auth ----------
class TestAuth:
    def test_register_new_user_and_autocreate_account(self, s):
        email = f"test_{uuid.uuid4().hex[:8]}@securebank.test"
        r = s.post(f"{API}/auth/register", json={"name": "TEST User", "email": email, "password": "Test@12345"})
        assert r.status_code == 201, r.text
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "user"
        # verify auto-created savings account
        h = {"Authorization": f"Bearer {data['token']}"}
        ra = s.get(f"{API}/accounts", headers=h)
        assert ra.status_code == 200
        accs = ra.json()["accounts"]
        assert len(accs) == 1
        assert accs[0]["accountType"] == "savings"
        assert accs[0]["balance"] == 0

    def test_register_duplicate_email(self, s):
        r = s.post(f"{API}/auth/register", json={"name": "Dup", "email": DEMO["email"], "password": "Test@12345"})
        assert r.status_code == 409

    def test_register_validation(self, s):
        r = s.post(f"{API}/auth/register", json={"name": "x", "email": "bad", "password": "Test@12345"})
        assert r.status_code == 400
        r = s.post(f"{API}/auth/register", json={"name": "x", "email": "ok@x.com", "password": "123"})
        assert r.status_code == 400

    def test_login_demo(self, s):
        tok, user = _login(s, DEMO)
        assert user["role"] == "user"
        assert user["email"] == DEMO["email"]

    def test_login_admin(self, s):
        tok, user = _login(s, ADMIN)
        assert user["role"] == "admin"

    def test_login_invalid(self, s):
        r = s.post(f"{API}/auth/login", json={"email": DEMO["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, s, demo_auth):
        r = s.get(f"{API}/auth/me", headers=demo_auth["headers"])
        assert r.status_code == 200
        assert r.json()["user"]["email"] == DEMO["email"]

    def test_protected_requires_token(self, s):
        r = s.get(f"{API}/accounts")
        assert r.status_code == 401


# ---------- module: accounts ----------
class TestAccounts:
    def test_list_and_create(self, s, demo_auth):
        r = s.get(f"{API}/accounts", headers=demo_auth["headers"])
        assert r.status_code == 200
        before = len(r.json()["accounts"])
        r2 = s.post(f"{API}/accounts", headers=demo_auth["headers"], json={"accountType": "current"})
        assert r2.status_code == 201
        acc = r2.json()["account"]
        assert acc["accountType"] == "current"
        assert acc["balance"] == 0
        r3 = s.get(f"{API}/accounts", headers=demo_auth["headers"])
        assert len(r3.json()["accounts"]) == before + 1

    def test_forbidden_other_user_account(self, s, demo_auth, admin_auth):
        # get an admin account id
        ra = s.get(f"{API}/accounts", headers=admin_auth["headers"])
        admin_acc_id = ra.json()["accounts"][0]["id"]
        r = s.get(f"{API}/accounts/{admin_acc_id}", headers=demo_auth["headers"])
        assert r.status_code == 403


# ---------- module: transactions (deposit / withdraw / transfer / fraud) ----------
class TestTransactions:
    def _primary_account(self, s, auth):
        r = s.get(f"{API}/accounts", headers=auth["headers"])
        return r.json()["accounts"][0]

    def test_deposit_and_withdraw(self, s, demo_auth):
        acc = self._primary_account(s, demo_auth)
        aid = acc["id"]
        before = acc["balance"]
        # deposit
        r = s.post(f"{API}/transactions/deposit", headers=demo_auth["headers"],
                   json={"accountId": aid, "amount": 1000, "description": "TEST deposit"})
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["balance"] == round(before + 1000, 2)
        # withdraw
        r2 = s.post(f"{API}/transactions/withdraw", headers=demo_auth["headers"],
                    json={"accountId": aid, "amount": 500, "description": "TEST wd"})
        assert r2.status_code == 201
        assert r2.json()["balance"] == round(before + 500, 2)

    def test_withdraw_insufficient(self, s, demo_auth):
        acc = self._primary_account(s, demo_auth)
        r = s.post(f"{API}/transactions/withdraw", headers=demo_auth["headers"],
                   json={"accountId": acc["id"], "amount": acc["balance"] + 100000})
        assert r.status_code == 400
        assert "Insufficient" in r.json().get("message", "")

    def test_deposit_invalid_amount(self, s, demo_auth):
        acc = self._primary_account(s, demo_auth)
        r = s.post(f"{API}/transactions/deposit", headers=demo_auth["headers"],
                   json={"accountId": acc["id"], "amount": -10})
        assert r.status_code == 400

    def test_transfer_success_and_creates_two_txns(self, s, demo_auth):
        accs = s.get(f"{API}/accounts", headers=demo_auth["headers"]).json()["accounts"]
        if len(accs) < 2:
            s.post(f"{API}/accounts", headers=demo_auth["headers"], json={"accountType": "current"})
            accs = s.get(f"{API}/accounts", headers=demo_auth["headers"]).json()["accounts"]
        assert len(accs) >= 2
        src, dst = accs[0], accs[1]
        # top up src if needed
        s.post(f"{API}/transactions/deposit", headers=demo_auth["headers"],
               json={"accountId": src["id"], "amount": 2000})
        r = s.post(f"{API}/transactions/transfer", headers=demo_auth["headers"],
                   json={"fromAccountId": src["id"], "toAccountNumber": dst["accountNumber"],
                         "amount": 500, "description": "TEST transfer"})
        assert r.status_code == 201, r.text
        # verify both legs exist
        listr = s.get(f"{API}/transactions", headers=demo_auth["headers"],
                      params={"q": "TEST transfer"}).json()["transactions"]
        types = {t["type"] for t in listr}
        assert "transfer_out" in types and "transfer_in" in types

    def test_transfer_insufficient(self, s, demo_auth, admin_auth):
        accs = s.get(f"{API}/accounts", headers=demo_auth["headers"]).json()["accounts"]
        admin_acc = s.get(f"{API}/accounts", headers=admin_auth["headers"]).json()["accounts"][0]
        r = s.post(f"{API}/transactions/transfer", headers=demo_auth["headers"],
                   json={"fromAccountId": accs[0]["id"], "toAccountNumber": admin_acc["accountNumber"],
                         "amount": 99999999})
        assert r.status_code == 400
        assert "Insufficient" in r.json().get("message", "")

    def test_transfer_bad_recipient(self, s, demo_auth):
        accs = s.get(f"{API}/accounts", headers=demo_auth["headers"]).json()["accounts"]
        r = s.post(f"{API}/transactions/transfer", headers=demo_auth["headers"],
                   json={"fromAccountId": accs[0]["id"], "toAccountNumber": "0000000000", "amount": 10})
        assert r.status_code == 404

    def test_large_amount_flagged_medium(self, s, demo_auth):
        # Deposit to have enough balance and then a MEDIUM (>=50000) flagged deposit
        acc = self._primary_account(s, demo_auth)
        r = s.post(f"{API}/transactions/deposit", headers=demo_auth["headers"],
                   json={"accountId": acc["id"], "amount": 60000, "description": "TEST med"})
        assert r.status_code == 201
        txn = r.json()["transaction"]
        assert txn["riskLevel"] in ("MEDIUM", "HIGH")
        assert txn["flagged"] is True

    def test_large_amount_flagged_high(self, s, demo_auth):
        acc = self._primary_account(s, demo_auth)
        r = s.post(f"{API}/transactions/deposit", headers=demo_auth["headers"],
                   json={"accountId": acc["id"], "amount": 150000, "description": "TEST high"})
        assert r.status_code == 201
        txn = r.json()["transaction"]
        assert txn["riskLevel"] == "HIGH"
        assert txn["flagged"] is True

    def test_history_filters(self, s, demo_auth):
        # type filter
        r = s.get(f"{API}/transactions", headers=demo_auth["headers"], params={"type": "deposit"})
        assert r.status_code == 200
        for t in r.json()["transactions"]:
            assert t["type"] == "deposit"
        # search filter
        r2 = s.get(f"{API}/transactions", headers=demo_auth["headers"], params={"q": "Salary"})
        assert r2.status_code == 200
        # amount filter
        r3 = s.get(f"{API}/transactions", headers=demo_auth["headers"], params={"minAmount": 100000})
        for t in r3.json()["transactions"]:
            assert t["amount"] >= 100000

    def test_analytics(self, s, demo_auth):
        r = s.get(f"{API}/transactions/analytics", headers=demo_auth["headers"])
        assert r.status_code == 200
        d = r.json()
        for k in ["totalBalance", "totalReceived", "totalTransferred", "flaggedCount",
                  "monthlyTrend", "typeBreakdown", "recentTransactions"]:
            assert k in d
        assert len(d["monthlyTrend"]) == 6
        assert d["flaggedCount"] >= 1


# ---------- module: beneficiaries ----------
class TestBeneficiaries:
    def test_add_list_delete(self, s, demo_auth, admin_auth):
        admin_acc = s.get(f"{API}/accounts", headers=admin_auth["headers"]).json()["accounts"][0]
        # cleanup any pre-existing
        existing = s.get(f"{API}/beneficiaries", headers=demo_auth["headers"]).json()["beneficiaries"]
        for b in existing:
            if b["accountNumber"] == admin_acc["accountNumber"]:
                s.delete(f"{API}/beneficiaries/{b['id']}", headers=demo_auth["headers"])
        r = s.post(f"{API}/beneficiaries", headers=demo_auth["headers"],
                   json={"name": "TEST Admin", "accountNumber": admin_acc["accountNumber"], "nickname": "adm"})
        assert r.status_code == 201, r.text
        bid = r.json()["beneficiary"]["id"]
        lr = s.get(f"{API}/beneficiaries", headers=demo_auth["headers"])
        assert any(b["id"] == bid for b in lr.json()["beneficiaries"])
        dr = s.delete(f"{API}/beneficiaries/{bid}", headers=demo_auth["headers"])
        assert dr.status_code == 200

    def test_add_own_account_rejected(self, s, demo_auth):
        own = s.get(f"{API}/accounts", headers=demo_auth["headers"]).json()["accounts"][0]
        r = s.post(f"{API}/beneficiaries", headers=demo_auth["headers"],
                   json={"name": "self", "accountNumber": own["accountNumber"]})
        assert r.status_code == 400

    def test_add_nonexistent_account(self, s, demo_auth):
        r = s.post(f"{API}/beneficiaries", headers=demo_auth["headers"],
                   json={"name": "ghost", "accountNumber": "9999999999"})
        assert r.status_code == 404


# ---------- module: admin RBAC ----------
class TestAdmin:
    def test_normal_user_blocked(self, s, demo_auth):
        for path in ["/admin/stats", "/admin/users", "/admin/accounts", "/admin/transactions", "/admin/suspicious"]:
            r = s.get(f"{API}{path}", headers=demo_auth["headers"])
            assert r.status_code == 403, f"{path} should be 403"

    def test_admin_stats(self, s, admin_auth):
        r = s.get(f"{API}/admin/stats", headers=admin_auth["headers"])
        assert r.status_code == 200
        d = r.json()
        for k in ["userCount", "accountCount", "txnCount", "flaggedCount", "highRisk", "totalDeposits", "totalVolume"]:
            assert k in d

    def test_admin_users_suspend_activate(self, s, admin_auth):
        # Use a throwaway user to avoid racing against other tests using demo
        email = f"suspend_{uuid.uuid4().hex[:8]}@securebank.test"
        reg = requests.post(f"{API}/auth/register", json={"name": "TEST Suspend", "email": email, "password": "Test@12345"})
        assert reg.status_code == 201
        uid = reg.json()["user"]["id"]
        r = s.put(f"{API}/admin/users/{uid}", headers=admin_auth["headers"], json={"status": "suspended"})
        assert r.status_code == 200
        assert r.json()["user"]["status"] == "suspended"
        rl = requests.post(f"{API}/auth/login", json={"email": email, "password": "Test@12345"})
        assert rl.status_code == 403
        r2 = s.put(f"{API}/admin/users/{uid}", headers=admin_auth["headers"], json={"status": "active"})
        assert r2.status_code == 200
        rl2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "Test@12345"})
        assert rl2.status_code == 200

    def test_admin_accounts_and_transactions(self, s, admin_auth):
        ar = s.get(f"{API}/admin/accounts", headers=admin_auth["headers"])
        assert ar.status_code == 200
        assert isinstance(ar.json()["accounts"], list) and len(ar.json()["accounts"]) > 0
        tr = s.get(f"{API}/admin/transactions", headers=admin_auth["headers"], params={"riskLevel": "HIGH"})
        assert tr.status_code == 200
        for t in tr.json()["transactions"]:
            assert t["riskLevel"] == "HIGH"

    def test_admin_suspicious(self, s, admin_auth):
        r = s.get(f"{API}/admin/suspicious", headers=admin_auth["headers"])
        assert r.status_code == 200
        for t in r.json()["transactions"]:
            assert t["flagged"] is True
