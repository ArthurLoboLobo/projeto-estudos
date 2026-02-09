# Step 03: Authentication (Register, Login, JWT Middleware)

**Status:** COMPLETED

**Prerequisites:** Step 02 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see "Authorization" section
- `implementation-plan/step-02-database-models.md` — read the Completion Notes

## Task

Implement user registration, login, and JWT-based auth middleware.

### 1. Auth Service (`app/services/auth.py`)

- **Password hashing:** Use `argon2-cffi` (Argon2id algorithm)
  - `hash_password(password: str) -> str`
  - `verify_password(password: str, hash: str) -> bool`

- **JWT:** Use `python-jose`
  - `create_token(user_id: UUID) -> str` — encode `{"sub": str(user_id), "exp": ...}` with `JWT_SECRET`
  - `decode_token(token: str) -> UUID` — decode and return user_id
  - Token expiry: 7 days

### 2. Auth Dependency (`app/dependencies.py` or inside `services/auth.py`)

Create a FastAPI dependency `get_current_user`:
- Extract `Authorization: Bearer <token>` from request headers
- Decode JWT → get user_id
- Fetch user from DB
- Return user or raise 401
- Also extract `x-language` header (default: `"pt"`)

### 3. Pydantic Schemas (`app/schemas/auth.py`)

- `RegisterRequest(email: str, password: str)`
- `LoginRequest(email: str, password: str)`
- `AuthResponse(token: str, user: UserResponse)`
- `UserResponse(id: UUID, email: str, created_at: datetime)`

### 4. Auth Router (`app/routers/auth.py`)

- **`POST /auth/register`**: Create user, return JWT + user
  - Validate email format
  - Check email uniqueness (handle DB constraint error)
  - Hash password, create profile, generate token

- **`POST /auth/login`**: Verify credentials, return JWT + user
  - Find user by email
  - Verify password
  - Return 401 if email not found or password wrong (same error message for both — don't reveal which failed)

### 5. Register router in main.py

Add the auth router to the FastAPI app.

## Acceptance Criteria

- [x] `POST /auth/register` creates user and returns token
- [x] `POST /auth/login` authenticates and returns token
- [x] Passwords stored as Argon2 hashes (never plaintext)
- [x] JWT tokens work with 7-day expiry
- [x] `get_current_user` dependency extracts user from token
- [x] `x-language` header is extracted and accessible
- [x] Duplicate email returns appropriate error
- [x] Invalid credentials return 401 with generic message

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

- **Files created:**
  - `app/services/auth.py` — Password hashing (argon2-cffi) + JWT (python-jose, HS256, 7-day expiry)
  - `app/schemas/auth.py` — Pydantic v2 schemas with `EmailStr` for email validation
  - `app/dependencies.py` — `get_current_user` (extracts Bearer token → decodes JWT → fetches Profile from DB) and `get_language` (extracts `x-language` header, defaults to `"pt"`)
  - `app/routers/auth.py` — `POST /auth/register` (201, handles IntegrityError for duplicate email → 409) and `POST /auth/login` (200, generic "Invalid email or password" for both wrong email and wrong password)
- **Files modified:**
  - `app/main.py` — Added `app.include_router(auth.router)`
  - `requirements.txt` — Added `email-validator>=2.0.0` (required by Pydantic's `EmailStr`)
- **Design decisions:**
  - `get_current_user` and `get_language` are separate dependencies (not combined) so endpoints can use one or both as needed.
  - `get_current_user` reads `Authorization` header directly (not via FastAPI's `OAuth2PasswordBearer`) — simpler and matches the existing frontend pattern of passing `Authorization: Bearer <token>`.
  - `decode_token` raises `ValueError` on any JWT error (expired, invalid, missing sub); `get_current_user` converts this to HTTP 401.
  - Duplicate email registration returns 409 Conflict (caught via SQLAlchemy `IntegrityError` on the unique constraint), not a generic 400.
  - `UserResponse` uses `model_config = {"from_attributes": True}` so it can be built directly from the SQLAlchemy `Profile` model via `model_validate()`.
- **All acceptance criteria verified** — imports, password hashing roundtrip, JWT roundtrip, and route registration all tested locally.
