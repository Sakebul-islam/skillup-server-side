# SkillUP Server

The Express and MongoDB REST API behind SkillUP, a MERN online learning platform for students, teachers and admins.

## Live demo

- App: [skillup-66.netlify.app](https://skillup-66.netlify.app/)
- Frontend code: [Sakebul-islam/SkillUP](https://github.com/Sakebul-islam/SkillUP)

## Features

- JWT auth: `POST /jwt` signs a token (15 days) and sets it as an httpOnly `token` cookie. Protected routes read this cookie.
- Users with roles (student, teacher, admin) and user search by username or email.
- Teacher applications with pending, approve and reject status. Approving or rejecting also updates the user's role.
- Classes: create, update, delete, approve or reject, and per-teacher lists.
- Assignments added to classes, assignment submissions and a count of today's submissions per class.
- Student feedback on classes.
- Stripe payment intents for class purchases. A saved payment increases the class enrollment count.
- Home page data: featured courses (top 4 approved by enrollment), top teachers by total enrollment, and site stats.
- CORS allows the live site and `localhost:5173` / `localhost:5174` with credentials.

## Tech stack

- Node.js and Express
- MongoDB (official `mongodb` driver)
- jsonwebtoken and cookie-parser
- Stripe
- cors, dotenv
- Vercel config (`vercel.json`) for deployment

## API routes

"JWT" means the route needs the `token` cookie.

**Auth**

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/jwt` | Create a JWT and set it as a cookie |
| GET | `/logout` | Clear the token cookie |

**Users**

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/users` | Save a new user |
| GET | `/users/:email` | Get one user (used for the role) |
| GET | `/users` | List all users, or search with `?searchTerm=` (JWT) |
| GET | `/profile?email=` | Get a user's profile (JWT) |
| PUT | `/users/update/:email` | Update a user and sync teacher status with the role (JWT) |

**Teachers**

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/teachers` | Submit a teacher application |
| PATCH | `/teachers/update-status/:email` | Set an application back to pending (re-apply) |
| GET | `/teachers?email=` | Get a user's pending, approved and rejected applications (JWT) |
| GET | `/teachers/requests` | List all teacher applications (JWT) |
| PUT | `/teachers/update-status/:id` | Approve or reject an application and update the user's role (JWT) |
| GET | `/top-teachers` | Teachers sorted by total enrollment |

**Classes and assignments**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/classes` | List all classes |
| GET | `/classes/:email` | List a teacher's classes |
| GET | `/classes/single/:id` | Get one class |
| POST | `/classes` | Add a class |
| PATCH | `/classes/update/:id` | Update a class (JWT) |
| PATCH | `/classes/update-status/:id` | Approve or reject a class (JWT) |
| DELETE | `/classes/:id` | Delete a class |
| GET | `/featured-courses` | Top 4 approved classes by enrollment |
| POST | `/classes/add-assignment/:id` | Add an assignment to a class (JWT) |
| GET | `/enrolled-classes/:email` | Classes a student has paid for (JWT) |
| POST | `/submit-assignment` | Submit an assignment (JWT) |
| GET | `/check-assignment` | A student's submissions for a class, by `email` and `classId` (JWT) |
| GET | `/submitted-assignments/:classId` | Count of today's submissions for a class (JWT) |

**Feedback, payments and stats**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/feedbacks` | List all feedback |
| GET | `/feedbacks/:classId` | Feedback for one class (JWT) |
| POST | `/submit-feedback` | Submit feedback for a class (JWT) |
| POST | `/create-payment-intent` | Create a Stripe payment intent from a price (JWT) |
| POST | `/payments/:id` | Save a payment and increase the class enrollment (JWT) |
| GET | `/stats` | Total users, approved classes and enrollments |
| GET | `/` | Health check message |

The server checks the JWT but does not check the user's role. Role-based access is handled in the frontend.

## Getting started

Requirements: Node.js, a MongoDB Atlas database and a Stripe account.

```bash
npm install
npm run dev     # node index.js
npm start       # nodemon index.js (install nodemon first)
```

The server runs on `PORT` or 5000 by default.

Create a `.env` file with these variables (names only):

- `PORT` (optional)
- `DB_USER`
- `BD_KEY` (MongoDB password; the name is spelled this way in the code)
- `ACCESS_TOKEN_SECRET`
- `PAYMENT_SECRET_KEY` (Stripe secret key)
- `NODE_ENV` (set to `production` for secure, cross-site cookies)

The MongoDB cluster host is set in `index.js`. Change it to point at your own cluster. The database name is `skillup`, with the collections `users`, `teachers`, `classes`, `payments`, `feedbacks` and `assignmentSubmit`.

## Project structure

```
skillup-server-side/
├── index.js        # Express app, MongoDB connection and all routes
├── package.json
└── vercel.json     # Vercel Node.js deployment config
```

## Author

Built by [Sakebul Islam](https://sakebul.com) · [LinkedIn](https://www.linkedin.com/in/sakebul-islam)
