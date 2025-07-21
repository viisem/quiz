// Mock data for different question types
const mockQuizData = {
    mcq: {
        title: "JavaScript Basics",
        questions: [
            {
                id: 1,
                question: "What is the correct way to declare a variable in JavaScript?",
                options: ["var name = 'John';", "variable name = 'John';", "v name = 'John';", "declare name = 'John';"],
                correct: 0,
                explanation: "In JavaScript, 'var', 'let', or 'const' are used to declare variables."
            },
            {
                id: 2,
                question: "Which method is used to add an element to the end of an array?",
                options: ["push()", "pop()", "shift()", "unshift()"],
                correct: 0,
                explanation: "The push() method adds one or more elements to the end of an array."
            },
            {
                id: 3,
                question: "What does 'NaN' stand for in JavaScript?",
                options: ["Not a Number", "Null and None", "New Array Node", "Not a Name"],
                correct: 0,
                explanation: "NaN stands for 'Not a Number' and represents a value that is not a legal number."
            }
        ]
    },
    multichoice: {
        title: "Web Technologies",
        questions: [
            {
                id: 1,
                question: "Which of the following are front-end frameworks? (Select all that apply)",
                options: ["React", "Django", "Vue.js", "Express.js", "Angular"],
                correct: [0, 2, 4],
                explanation: "React, Vue.js, and Angular are front-end frameworks. Django is a back-end framework and Express.js is a Node.js framework."
            },
            {
                id: 2,
                question: "Which CSS properties can be used for positioning? (Select all that apply)",
                options: ["position", "display", "float", "z-index", "color"],
                correct: [0, 1, 2, 3],
                explanation: "Position, display, float, and z-index are all CSS properties used for positioning elements."
            }
        ]
    },
    fillblanks: {
        title: "Python Programming",
        questions: [
            {
                id: 1,
                question: "In Python, you use the _____ keyword to define a function, and _____ to import modules.",
                blanks: ["def", "import"],
                template: "In Python, you use the _____ keyword to define a function, and _____ to import modules.",
                explanation: "The 'def' keyword defines functions and 'import' is used to include modules."
            },
            {
                id: 2,
                question: "Python lists are _____ and can contain _____ data types.",
                blanks: ["mutable", "mixed"],
                template: "Python lists are _____ and can contain _____ data types.",
                explanation: "Lists in Python are mutable (can be changed) and can store mixed data types."
            }
        ]
    },
    match: {
        title: "Programming Concepts",
        questions: [
            {
                id: 1,
                question: "Match the programming languages with their primary use cases:",
                leftColumn: [
                    { id: 'js', text: 'JavaScript' },
                    { id: 'python', text: 'Python' },
                    { id: 'sql', text: 'SQL' },
                    { id: 'css', text: 'CSS' }
                ],
                rightColumn: [
                    { id: 'web-styling', text: 'Web Styling' },
                    { id: 'database-queries', text: 'Database Queries' },
                    { id: 'web-interactivity', text: 'Web Interactivity' },
                    { id: 'data-science', text: 'Data Science' }
                ],
                correct: {
                    'js': 'web-interactivity',
                    'python': 'data-science',
                    'sql': 'database-queries',
                    'css': 'web-styling'
                },
                explanation: "Each programming language has its strengths: JavaScript for web interactivity, Python for data science, SQL for databases, and CSS for styling."
            }
        ]
    }
};

// Function to get mock data based on question type and count
function getMockQuiz(type, count, topic) {
    const mockData = mockQuizData[type];
    if (!mockData) return null;

    // Simulate API response structure
    return {
        success: true,
        quiz: {
            id: Date.now().toString(),
            title: `${topic} - ${mockData.title}`,
            type: type,
            questions: mockData.questions.slice(0, parseInt(count)),
            totalQuestions: parseInt(count)
        }
    };
}

// Function to simulate API delay
function simulateApiDelay() {
    return new Promise(resolve => {
        setTimeout(resolve, 2000 + Math.random() * 1000); // 2-3 seconds delay
    });
}