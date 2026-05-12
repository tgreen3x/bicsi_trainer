/*
  BICSI Technical Workstation
  Basic development tests
*/

function runTests() {
  console.log("Running tests...");

  console.assert(rankFromTotal(28) === "EXAM DOMINANT", "28 should be EXAM DOMINANT");
  console.assert(rankFromTotal(26) === "TECHNICIAN READY", "26 should be TECHNICIAN READY");
  console.assert(rankFromTotal(23) === "JUNIOR TECH", "23 should be JUNIOR TECH");
  console.assert(rankFromTotal(18) === "SENIOR INSTALLER", "18 should be SENIOR INSTALLER");
  console.assert(rankFromTotal(10) === "INSTALLER", "10 should be INSTALLER");

  console.log("Rank tests complete.");
const validQuestion = {
  id: "TEST-001",
  domain: "Fiber",
  difficulty: 2,
  style: "DEF",
  q: "Microbending primarily increases:",
  choices: ["Reflectance", "Attenuation", "Speed", "Crosstalk"],
  answer: 1,
  ref: "Test",
  hint: "Stress causes loss."
};

console.assert(
  normalizeQuestion(validQuestion).id === "TEST-001",
  "Valid multiple choice question should normalize"
);

const badQuestionMissingId = {
  domain: "Fiber",
  q: "Missing ID test",
  choices: ["A", "B", "C", "D"],
  answer: 1
};

console.assert(
  normalizeQuestion(badQuestionMissingId) === null,
  "Question missing ID should be rejected"
);

const badQuestionWrongChoices = {
  id: "BAD-CHOICES",
  domain: "Fiber",
  q: "Bad choices test",
  choices: ["A", "B"],
  answer: 1
};

console.assert(
  normalizeQuestion(badQuestionWrongChoices) === null,
  "Multiple choice question with fewer than 4 choices should be rejected"
);

console.log("Question normalization tests complete.");
const bankWithDuplicate = [
  validQuestion,
  { ...validQuestion, id: "TEST-001" },
  badQuestionMissingId
];

const report = validateQuestionBank(bankWithDuplicate);

console.assert(report.total === 3, "Validator should count total questions");
console.assert(report.valid === 2, "Validator should count valid questions");
console.assert(report.invalid === 1, "Validator should count invalid questions");
console.assert(report.duplicateIds.includes("TEST-001"), "Validator should detect duplicate IDs");

console.log("Question bank validator tests complete.");
}
