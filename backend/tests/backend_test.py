"""SecureBank FastAPI backend regression tests."""
import os
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


@pytest.fixture(scope="session")
def s():
    return requests.Session()


def _login(s, creds):
    r = s.post(f"{API}/auth/login", json=creds)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def demo_token(s):
    return _login(s, DEMO)["token"]


@pytest.fixture(scope="session")
def admin_token(s):
    return _login(s, ADMIN)["token"]


def h(token):
    return {"Authorization": f"Bearer {token}"}


class TestHealth:
    def test_health(self, s):
        r = s.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


class TestAuth:
    def test_login_admin(self, s):
        data = _login(s, ADMIN)
        assert data["user"]["role"] == "admin"
        assert data["token"]

    def test_login_demo(self, s):
        data = _login(s, DEMO)
        assert data["user"]["role"] == "user"

    def test_login_bad(self, s):
        r = s.post(f"{API}/auth/login", json={"email": DEMO["email"], "password": "wrong"})
        assert r.status_code == 401
        assert "message" in r.json()

    def test_me_requires_auth(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me(self, s, demo_token):
        r = s.get(f"{API}/auth/me", headers=h(demo_token))
        assert r.status_code == 200
        assert r.json()["user"]["email"] == DEMO["email"]

    def test_register_creates_account(self, s):
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={"name": "Test Reg", "email": email, "password": "Passw0rd!"})
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        acc = s.get(f"{API}/accounts", headers=h(token))
        accts = acc.json()["accounts"]
        assert len(accts) == 1
        assert accts[0]["accountType"] == "savings"
        assert accts[0]["balance"] == 0

    def test_register_duplicate(self, s):
        r = s.post(f"{API}/auth/register", json={"name": "Dup", "email": DEMO["email"], "password": "Passw0rd!"})
        assert r.status_code == 409


class TestProfile:
    def test_update_profile(self, s, demo_token):
        r = s.put(f"{API}/users/profile", json={"phone": "9999999999", "address": "TEST addr"}, headers=h(demo_token))
        assert r.status_code == 200
        r2 = s.get(f"{API}/users/profile", headers=h(demo_token))
        assert r2.json()["user"]["phone"] == "9999999999"
        assert r2.json()["user"]["address"] == "TEST addr"


class TestBanking:
    def test_create_account(self, s, demo_token):
        r = s.post(f"{API}/accounts", json={"accountType": "current"}, headers=h(demo_token))
        assert r.status_code == 200
        a = r.json()["account"]
        assert a["accountType"] == "current"
        assert len(a["accountNumber"]) == 12

    def test_deposit_low_risk(self, s, demo_token):
        acc = s.get(f"{API}/accounts", headers=h(demo_token)).json()["accounts"][0]
        before = acc["balance"]
        r = s.post(f"{API}/transactions/deposit", json={"accountId": acc["id"], "amount": 1000, "description": "TEST"}, headers=h(demo_token))
        assert r.status_code == 200
        assert r.json()["balance"] == round(before + 1000, 2)
        assert r.json()["transaction"]["riskLevel"] == "LOW"

    def test_deposit_medium_risk(self, s, demo_token):
        acc = s.get(f"{API}/accounts", headers=h(demo_token)).json()["accounts"][0]
        r = s.post(f"{API}/transactions/deposit", json={"accountId": acc["id"], "amount": 50000}, headers=h(demo_token))
        assert r.json()["transaction"]["riskLevel"] in ("MEDIUM", "HIGH")
        assert r.json()["transaction"]["flagged"] is True

    def test_deposit_high_risk(self, s, demo_token):
        acc = s.get(f"{API}/accounts", headers=h(demo_token)).json()["accounts"][0]
        r = s.post(f"{API}/transactions/deposit", json={"accountId": acc["id"], "amount": 120000}, headers=h(demo_token))
        assert r.json()["transaction"]["riskLevel"] == "HIGH"

    def test_withdraw(self, s, demo_token):
        acc = s.get(f"{API}/accounts", headers=h(demo_token)).json()["accounts"][0]
        before = acc["balance"]
        r = s.post(f"{API}/transactions/withdraw", json={"accountId": acc["id"], "amount": 100}, headers=h(demo_token))
        assert r.status_code == 200
        assert r.json()["balance"] == round(before - 100, 2)

    def test_withdraw_insufficient(self, s, demo_token):
        acc = s.get(f"{API}/accounts", headers=h(demo_token)).json()["accounts"][0]
        r = s.post(f"{API}/transactions/withdraw", json={"accountId": acc["id"], "amount": acc["balance"] + 999999}, headers=h(demo_token))
        assert r.status_code == 400
        assert "Insufficient" in r.json()["message"]

    def test_transfer_flow(self, s, demo_token):
        email = f"TEST_rcv_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{API}/auth/register", json={"name": "Receiver", "email": email, "password": "Passw0rd!"}).json()
        rcv_token = reg["token"]
        rcv_acc = s.get(f"{API}/accounts", headers=h(rcv_token)).json()["accounts"][0]
        src = s.get(f"{API}/accounts", headers=h(demo_token)).json()["accounts"][0]

        r_same = s.post(f"{API}/transactions/transfer", json={"fromAccountId": src["id"], "toAccountNumber": src["accountNumber"], "amount": 10}, headers=h(demo_token))
        assert r_same.status_code == 400

        r_ne = s.post(f"{API}/transactions/transfer", json={"fromAccountId": src["id"], "toAccountNumber": "000000000000", "amount": 10}, headers=h(demo_token))
        assert r_ne.status_code == 404

        r_ok = s.post(f"{API}/transactions/transfer", json={"fromAccountId": src["id"], "toAccountNumber": rcv_acc["accountNumber"], "amount": 500}, headers=h(demo_token))
        assert r_ok.status_code == 200

        rcv_txns = s.get(f"{API}/transactions", headers=h(rcv_token)).json()["transactions"]
        assert any(t["type"] == "transfer_in" and t["amount"] == 500 for t in rcv_txns)

        r_bad = s.post(f"{API}/transactions/transfer", json={"fromAccountId": src["id"], "toAccountNumber": rcv_acc["accountNumber"], "amount": 99999999}, headers=h(demo_token))
        assert r_bad.status_code == 400


class TestTransactionsList:
    def test_filter_type(self, s, demo_token):
        r = s.get(f"{API}/transactions", params={"type": "deposit"}, headers=h(demo_token))
        assert all(t["type"] == "deposit" for t in r.json()["transactions"])

    def test_filter_amount(self, s, demo_token):
        r = s.get(f"{API}/transactions", params={"minAmount": 40000, "maxAmount": 60000}, headers=h(demo_token))
        for t in r.json()["transactions"]:
            assert 40000 <= t["amount"] <= 60000

    def test_analytics(self, s, demo_token):
        r = s.get(f"{API}/transactions/analytics", headers=h(demo_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("totalBalance", "totalReceived", "totalTransferred", "flaggedCount",
                  "monthlyTrend", "typeBreakdown", "recentTransactions"):
            assert k in d
        assert len(d["monthlyTrend"]) == 6


class TestBeneficiaries:
    def test_ben_flow(self, s, demo_token):
        email = f"TEST_ben_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{API}/auth/register", json={"name": "Ben Target", "email": email, "password": "Passw0rd!"}).json()
        target_acc = s.get(f"{API}/accounts", headers=h(reg["token"])).json()["accounts"][0]
        own = s.get(f"{API}/accounts", headers=h(demo_token)).json()["accounts"][0]

        r_own = s.post(f"{API}/beneficiaries", json={"name": "self", "accountNumber": own["accountNumber"]}, headers=h(demo_token))
        assert r_own.status_code == 400

        r_none = s.post(f"{API}/beneficiaries", json={"name": "x", "accountNumber": "000000000000"}, headers=h(demo_token))
        assert r_none.status_code == 404

        r_add = s.post(f"{API}/beneficiaries", json={"name": "Ben Target", "accountNumber": target_acc["accountNumber"], "nickname": "TEST"}, headers=h(demo_token))
        assert r_add.status_code == 200
        bid = r_add.json()["beneficiary"]["id"]

        lst = s.get(f"{API}/beneficiaries", headers=h(demo_token)).json()["beneficiaries"]
        assert any(b["id"] == bid for b in lst)

        d = s.delete(f"{API}/beneficiaries/{bid}", headers=h(demo_token))
        assert d.status_code == 200


class TestAdmin:
    def test_rbac_forbidden(self, s, demo_token):
        for path in ("/admin/stats", "/admin/users", "/admin/accounts", "/admin/transactions", "/admin/suspicious"):
            r = s.get(f"{API}{path}", headers=h(demo_token))
            assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_admin_stats(self, s, admin_token):
        r = s.get(f"{API}/admin/stats", headers=h(admin_token))
        assert r.status_code == 200
        for k in ("userCount", "accountCount", "txnCount", "flaggedCount", "highRisk", "totalDeposits", "totalVolume"):
            assert k in r.json()

    def test_admin_users(self, s, admin_token):
        u = s.get(f"{API}/admin/users", headers=h(admin_token)).json()["users"]
        assert any(x["email"] == DEMO["email"] for x in u)
        assert "totalBalance" in u[0]

    def test_admin_accounts(self, s, admin_token):
        a = s.get(f"{API}/admin/accounts", headers=h(admin_token)).json()["accounts"]
        assert a and "ownerEmail" in a[0] and "ownerName" in a[0]

    def test_admin_txn_risk_filter(self, s, admin_token):
        t = s.get(f"{API}/admin/transactions", params={"riskLevel": "HIGH"}, headers=h(admin_token)).json()["transactions"]
        assert all(x["riskLevel"] == "HIGH" for x in t)

    def test_admin_suspicious(self, s, admin_token):
        sus = s.get(f"{API}/admin/suspicious", headers=h(admin_token)).json()["transactions"]
        assert all(x["flagged"] for x in sus)

    def test_admin_suspend_blocks_login(self, s, admin_token):
        email = f"TEST_susp_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{API}/auth/register", json={"name": "Vic", "email": email, "password": "Passw0rd!"}).json()
        uid = reg["user"]["id"]

        r = s.put(f"{API}/admin/users/{uid}", json={"status": "suspended"}, headers=h(admin_token))
        assert r.status_code == 200
        assert r.json()["user"]["status"] == "suspended"

        r2 = s.post(f"{API}/auth/login", json={"email": email, "password": "Passw0rd!"})
        assert r2.status_code == 403

        r3 = s.put(f"{API}/admin/users/{uid}", json={"status": "active"}, headers=h(admin_token))
        assert r3.status_code == 200
        r4 = s.post(f"{API}/auth/login", json={"email": email, "password": "Passw0rd!"})
        assert r4.status_code == 200
