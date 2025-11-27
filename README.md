# Restaurant Management System

A comprehensive restaurant management system with customer, staff, and owner interfaces.

## Features

- **Customer Interface**
  - Browse menu
  - Place orders
  - Make payments (Cash/Midtrans)
  - View order status

- **Staff Interface**
  - Manage orders
  - Update order status
  - Process payments
  - Print receipts

- **Owner Interface**
  - Manage menu items
  - View sales reports
  - Manage staff accounts
  - View analytics

## Tech Stack

- **Frontend**: React.js + Tailwind CSS
- **Backend**: Node.js + Express.js
- **Database**: 
  - PostgreSQL (for operational data)
  - MongoDB (for reporting)
- **Authentication**: JWT
- **Payment Gateway**: Midtrans (for online payments)

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL (v12 or higher)
- MongoDB (v4.4 or higher)
- Git

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/restaurant_app.git
cd restaurant_app
```

### 2. Install Dependencies

#### Backend

```bash
cd backend
npm install
```

#### Frontend (to be implemented)

```bash
cd ../frontend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Server
NODE_ENV=development
PORT=5000

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=restaurant_app
DB_USER=your_db_username
DB_PASSWORD=your_db_password

# MongoDB
MONGO_URI=mongodb://localhost:27017/restaurant_reports

# Midtrans (for online payments)
MIDTRANS_SERVER_KEY=your_midtrans_server_key
MIDTRANS_CLIENT_KEY=your_midtrans_client_key
MIDTRANS_IS_PRODUCTION=false
```

### 4. Database Setup

#### PostgreSQL

1. Create a new database:
   ```bash
   createdb restaurant_app
   ```

2. The tables will be created automatically when the server starts (using Sequelize sync).

#### MongoDB

1. Make sure MongoDB is running locally
2. The database and collections will be created automatically when the server starts.

### 5. Start the Development Servers

#### Backend

```bash
cd backend
npm run dev
```

The API will be available at `http://localhost:5000`

#### Frontend (to be implemented)

```bash
cd frontend
npm start
```

The frontend will be available at `http://localhost:3000`

## API Documentation

API documentation is available at `/api-docs` when running in development mode.

## Available Scripts

### Backend

- `npm start` - Start the production server
- `npm run dev` - Start the development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run migrate` - Run database migrations

## Project Structure

```
restaurant_app/
├── backend/                 # Backend source code
│   ├── config/             # Configuration files
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Custom middleware
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   ├── utils/              # Utility functions
│   ├── server.js           # Express application
│   └── package.json
├── frontend/               # Frontend source code (to be implemented)
└── README.md
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
