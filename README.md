# BICSI Technical Workstation

BICSI Technical Workstation is a browser-based study trainer built to help telecommunications apprentices practice certification-style questions, review missed concepts, and build a daily study habit.

The project started as a single-file HTML prototype and was later refactored into a more maintainable web app with separated HTML, CSS, JavaScript, storage logic, and an external JSON question bank.

## Live Demo

https://tgreen3x.github.io/bicsi_trainer/

## Project Purpose

This project was created as a first web development project and apprenticeship study aid. The goal is to provide a focused training environment for BICSI-style technician study using quizzes, flashcards, missed-question review, and daily practice tracking.

The app is designed around the idea that missed questions should become targeted review material instead of simply being marked wrong.

## Features

- Daily training workflow
- Timed pressure round
- Missed-question review deck
- Flashcards
- Wording practice lab
- Local progress tracking
- Streak tracking
- Domain performance tracking
- Adaptive and rotating question selection
- External JSON question bank
- Question bank validation
- Multiple visual themes
- Keyboard accessibility improvements
- Import/export style local storage support

## Current Question Bank

The current question bank contains 262 loaded questions.

Questions are stored in:

```text
question-bank.json

The question bank is loaded with:

fetch("./question-bank.json", { cache: "no-store" });
Tech Stack
HTML
CSS
JavaScript
JSON
localStorage
GitHub Pages
File Structure

This project currently uses a flat file structure for simple GitHub Pages deployment.

index.html
styles.css
app.js
storage.js
question-bank.json
tests.js
README.md
QA-CHECKLIST.md

Important file references:

<link rel="stylesheet" href="./styles.css">

<script src="./storage.js"></script>
<script src="./app.js"></script>
How to Run Locally

Because the app loads an external JSON file, it should be run from a local server instead of opening index.html directly.

One simple option is to use the VS Code Live Server extension.

Steps:

Open the project folder in VS Code.
Start Live Server.
Open the local browser URL.
Confirm the question bank count loads correctly.
How to Use
Open the app.
Choose a study mode.
Answer questions.
Review missed questions.
Use flashcards and wording practice for extra review.
Track progress over time locally in the browser.
Data Storage

The app uses browser localStorage to save study progress on the user's device.

Stored data may include:

Theme preference
Font size preference
Scores
Missed questions
Domain stats
Daily progress
Rotation state

This project does not currently use user accounts, a backend server, or a database.

Testing and Validation

The project includes basic testing and validation logic in:

tests.js

Current validation work includes:

Console tests for helper functions
Question normalization checks
True/false answer normalization
Question bank validation
Duplicate ID detection
Invalid question detection
Accessibility and UX Improvements

Accessibility and usability improvements include:

Visible focus styles
Keyboard menu support
ARIA labels for decorative controls
Empty-question-bank protection
Multiple visual themes
Adjustable display settings
What I Learned

While building this project, I learned how to:

Refactor a single-file HTML project into separate files
Load an external JSON question bank
Debug file path problems on GitHub Pages
Use localStorage for browser-based progress tracking
Improve keyboard accessibility
Validate structured question data
Document and prepare a project for portfolio use
Known Limitations

This is currently a browser-only localStorage MVP.

Known limitations:

No user accounts
No backend database
No instructor dashboard
No cohort or class tracking
No automated CI test pipeline
Progress is stored only on the current browser/device
Duplicate question IDs may exist and should be cleaned up later
Future Roadmap

Possible future improvements include:

Auto-generated flashcards from missed questions
Domain weakness dashboard
Explanations after grading
Daily goal progress bar
Exportable study profile
Question bank validator screen
Study mode by domain
Progressive Web App support
Apprentice and instructor accounts
Instructor dashboard for company, cohort, class year, domain, and individual progress tracking
Project Pitch

BICSI Technical Workstation is a beginner-built browser study trainer for telecommunications apprenticeship learning. It helps users practice questions, review missed material, build flashcards, and track local progress without requiring an account or backend system.

The project demonstrates HTML, CSS, JavaScript, JSON data handling, localStorage, accessibility improvements, debugging, testing, and project documentation.

Status

Day 7 cleanup and portfolio preparation are in progress.

The project is functional as a localStorage-based MVP and ready for final QA before being shared as a beginner web development portfolio project.
