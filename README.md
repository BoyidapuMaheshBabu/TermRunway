# TermRunway 💸

> **A student-focused budget planning web application.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-00C853?style=for-the-badge)](https://termrunway.netlify.app/)
[![Status](https://img.shields.io/badge/Status-Active%20Development-orange?style=for-the-badge)](https://github.com/BoyidapuMaheshBabu/TermRunway)

**Try it:** [termrunway.netlify.app](https://termrunway.netlify.app/)

## What is TermRunway?

TermRunway is a student-focused budgeting application that helps track income and expenses, understand the remaining balance, and estimate a practical daily spending limit for the time remaining in a semester or month.

## Key Features

- Multiple income sources and expense categories
- Semester and monthly budgeting modes
- Automatic income, expense, balance, and daily-limit calculations
- 50/30/20 budgeting reference
- Persistent browser storage using `localStorage`
- Reset budget functionality
- Printable / PDF-friendly budget summary
- Responsive mobile, tablet, and desktop layouts
- Input validation and edge-case handling

## How It Works

```text
Income + Planned Expenses
          ↓
    Remaining Balance
          ↓
     Time Remaining
          ↓
 Daily Spending Limit
```

The application handles cases such as missing dates, expired periods, zero income, expenses exceeding available funds, and invalid numeric input.

## What I Learned

I built TermRunway incrementally with AI assistance and used the project to learn concepts and tools as they became necessary during development.

Working on the application gave me practical experience with:

- application logic and calculations
- input validation and edge cases
- date handling
- structured data and JSON
- browser `localStorage`
- responsive layouts
- browser print functionality
- debugging and maintaining an evolving project

The project is part of my approach of **learning through building**: encounter a problem, learn what is needed, implement it, test it, and improve the result.

## Technology Stack

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript

### Browser APIs

- `localStorage`
- DOM APIs
- Date handling
- Browser print functionality

### Development & Deployment

- Git
- GitHub
- Netlify

## Project Structure

```text
TermRunway/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
└── README.md
```

## Development & Testing

The project is maintained through incremental changes and browser testing while features are added or modified.

Examples of problems addressed during development include:

- monthly date calculations
- expired semester dates
- negative remaining balances
- number-input validation
- desktop layout issues
- mobile responsiveness
- print/PDF layout

## Roadmap

Planned improvements may include:

- more detailed budget analytics
- charts and spending insights
- additional export options
- accessibility improvements
- more student-focused planning tools
- further validation and testing

The roadmap may change as the project evolves.

## 👨‍💻 Developer

**Boyidapu Mahesh Babu**  
Diploma in Computer Science Engineering student

GitHub: [@BoyidapuMaheshBabu](https://github.com/BoyidapuMaheshBabu)

---

**Built incrementally as a practical learning project, with AI assistance and continuous improvement.**
