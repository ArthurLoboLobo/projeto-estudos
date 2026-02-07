# Step 03: Authentication (Register, Login, JWT Middleware)

**Status:** PENDING

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

- [ ] `POST /auth/register` creates user and returns token
- [ ] `POST /auth/login` authenticates and returns token
- [ ] Passwords stored as Argon2 hashes (never plaintext)
- [ ] JWT tokens work with 7-day expiry
- [ ] `get_current_user` dependency extracts user from token
- [ ] `x-language` header is extracted and accessible
- [ ] Duplicate email returns appropriate error
- [ ] Invalid credentials return 401 with generic message

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
