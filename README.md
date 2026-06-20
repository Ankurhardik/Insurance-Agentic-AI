# Insurance Agentic AI

An agentic AI assistant and administrative workspace tailored for insurance operations. The system features a modern three-pane dashboard, secure role-based access control (RBAC), Google OAuth support, session-based authentication, and a real-time database-backed admin elevation request queue.

---

## Key Features

### 🔐 Role-Based Access Control (RBAC) & Security
* **Dual Roles**: Supports standard `user` and `admin` (Director) roles with tailored workspaces.
* **Authentication**: Session-based login with automatic token checking, secure password hashing, and clean logout flows.
* **Google OAuth 2.0**: Simple and secure login using Google Accounts.
* **Sign Out Protection**: Confirmation pop-up before logging out to prevent session disruption.

### 📈 Database-Backed Elevation Requests
* **Standard User Elevation**: Users can submit a clearance elevation request to Clearance Level 5 directly from the UI.
* **Admin Request Queue**: Admins view a real-time list of pending access requests.
* **Approve / Decline Actions**: Admins can approve (instantly elevating the user role to admin) or decline requests.
* **Interactive Notifications**: A sleek notifications bell dropdown popup showing request status for users and quick elevation controls for admins.

### 🤖 Intelligent Chat & Workspace Operations
* **Role-Specific Context**: Custom welcoming, greetings, and system messages based on the user's role.
* **Quick Actions**: Preset shortcuts to compile market reports, draft briefing notes, audit operations, or synchronize knowledge bases.
* **Conversational AI Agent**: Interactive chat layout simulating policy calculations, underwriting stats, and system administration logic.
* **Three-Pane Dashboard**: Clean layout featuring left-hand navigation, middle chat stream with quick actions, and right-hand profile & administrative tools.

---

## Tech Stack

### Backend
* **FastAPI**: High-performance, modern Python web framework for APIs.
* **SQLAlchemy**: Powerful Python SQL toolkit and ORM.
* **PostgreSQL**: Robust open-source relational database.
* **Alembic**: Database migrations management.
* **Uvicorn**: Lightning-fast ASGI server implementation.

### Frontend
* **Next.js (App Router)**: React framework with fast file-based routing.
* **React 19 & TypeScript**: Type-safe development with modern rendering lifecycles.
* **Tailwind CSS v4**: Utility-first styling for rich aesthetics, sleek dark-mode accents, and smooth transitions.
* **Turbopack**: Fast incremental bundler.

---

## Project Structure

```
Insurance-Agentic-AI/
│
├── Backend/                 # Python FastAPI backend
│   ├── src/
│   │   ├── api/             # API routes and main entrypoint
│   │   ├── core/            # Security, hashing, and configuration
│   │   ├── db/              # Session and base models setup
│   │   ├── models/          # SQLAlchemy Database Models (User, AccessRequest)
│   │   └── schemas/         # Pydantic validation schemas
│   ├── alembic/             # Alembic migration scripts and versions
│   └── alembic.ini          # Alembic configuration
│
├── Frontend/                # Next.js frontend
│   ├── public/              # Static assets
│   └── src/
│       └── app/             # Next.js App Router views (Home, Callback)
│
├── pyproject.toml           # Python package requirements and metadata
└── docker-compose.yml       # Dev database / service configuration
```

---

## Setup & Installation

### Prerequisites
* Python >= 3.11
* Node.js >= 18
* PostgreSQL (Running locally or via Docker)

### 1. Database Setup
Ensure you have a PostgreSQL database running. You can launch one using the provided Docker Compose configuration:
```bash
docker-compose up -d
```

### 2. Backend Setup
1. Open a terminal in the project root.
2. Initialize and activate the virtual environment:
   ```bash
   # Windows
   .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   uv pip install -e .
   # or
   pip install -r requirements.txt
   ```
4. Configure your `.env` variables at the project root:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/insurance_db
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```
5. Apply database migrations:
   ```bash
   cd Backend
   alembic upgrade head
   ```
6. Start the API server:
   ```bash
   python -m uvicorn Backend.src.api.main:app --reload
   ```
   The backend will be running at `http://127.0.0.1:8000`.

### 3. Frontend Setup
1. Open a terminal in the `Frontend/` folder.
2. Install package dependencies:
   ```bash
   npm install
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
   The application will be running at `http://localhost:3000`.

---

## Verification & Seeding Admins

1. Register an account at `http://localhost:3000`.
2. Newly created accounts default to `"user"` role. To manually elevate a user to `"admin"` directly in the database (e.g. your primary admin account `ankurhardik123@gmail.com`), execute this seeding command:
   ```powershell
   .venv\Scripts\python -c "from sqlalchemy import select; from Backend.src.db.session import SessionLocal; from Backend.src.models.user import User; db = SessionLocal(); u = db.execute(select(User).where(User.email == 'ankurhardik123@gmail.com')).scalar_one_or_none(); u.role = 'admin'; db.commit(); print('Successfully elevated ankurhardik123@gmail.com to admin role')"
   ```
3. Standard users can request elevation from the right sidebar panel. Admins can view and approve these requests under the **Notification Bell** dropdown popup or the sidebar **Admin Requests Queue** to grant instant administrator privileges.
