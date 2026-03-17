# GKrecharge - Virtual Top-Up Platform

A comprehensive Node.js web application for virtual top-up services including airtime, data bundles, TV subscriptions, and airtime-to-cash conversion.

## Features

### User Features
- **User Registration & Login**: Secure authentication with email validation
- **User Dashboard**: Comprehensive dashboard showing wallet balance and recent transactions
- **Wallet System**: Integrated wallet for managing funds with deposit and withdrawal capabilities
- **Transaction History**: Complete transaction history with filtering and pagination
- **Profile Management**: User profile editing with validation
- **Airtime Purchase**: Buy airtime for MTN, Airtel, Glo, and 9mobile
- **Data Bundle Purchase**: Purchase data bundles for all major networks
- **TV Subscription**: Subscribe to DSTV, GOTV, Startimes, and other TV services
- **Airtime to Cash**: Convert airtime to cash for all supported networks

### Admin Features
- **Admin Dashboard**: Overview of system statistics, recent users, and transactions
- **User Management**: View, search, and manage all users
- **Product Management**: Add, edit, delete, and manage products and pricing
- **Wallet Management**: Add or withdraw funds from user wallets
- **Transaction Monitoring**: View and manage all transactions with filtering
- **System Settings**: Configure API integrations and system parameters

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (with support for MySQL/MongoDB)
- **Authentication**: JWT (JSON Web Tokens) with bcrypt password hashing
- **Frontend**: Bootstrap 5, HTML5, CSS3, JavaScript
- **Security**: CORS, Helmet, rate limiting, input validation

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd gkrecharge-website
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update database and JWT settings as needed

4. Initialize the database:
   ```bash
   npm run setup
   ```

5. Start the server:
   ```bash
   npm start
   ```

6. Access the application:
   - User area: http://localhost:3000
   - Admin area: http://localhost:3000/admin
   - Default admin: admin/admin123

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Token verification
- `POST /api/auth/logout` - User logout
- `POST /api/auth/change-password` - Password change

### User API
- `GET /api/user/dashboard` - Dashboard data
- `GET /api/user/wallet` - Wallet information
- `POST /api/user/wallet/add` - Add funds
- `POST /api/user/wallet/withdraw` - Withdraw funds
- `GET /api/user/transactions` - Transaction history
- `GET /api/user/profile` - User profile
- `PUT /api/user/profile` - Update profile
- `GET /api/user/products` - Available products
- `POST /api/user/purchase` - Make purchase
- `POST /api/user/airtime-to-cash` - Airtime conversion

### Admin API
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/users` - User management
- `GET /api/admin/users/:id` - User details
- `POST /api/admin/users/:id/wallet` - Manage user wallet
- `GET /api/admin/products` - Product management
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/:id` - Update product
- `DELETE /api/admin/products/:id` - Delete product
- `GET /api/admin/transactions` - Transaction monitoring
- `PUT /api/admin/transactions/:id/status` - Update transaction status
- `GET /api/admin/settings` - System settings
- `PUT /api/admin/settings` - Update settings

## Security Features

- Password hashing with bcrypt
- JWT authentication with expiration
- Input validation and sanitization
- CORS configuration
- Helmet security headers
- Rate limiting on authentication endpoints
- SQL injection prevention with parameterized queries
- Password visibility toggle for better UX
- 5-character password requirement (letters and numbers only)

## Browser Compatibility

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS/Android)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.