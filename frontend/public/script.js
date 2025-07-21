class QuizApp {
    constructor() {
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.isSubmitted = false;
        this.selectedMatches = {};
        this.apiUrl = window.location.origin + '/api';
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // Setup section elements
        this.setupSection = document.getElementById('quiz-setup');
        this.topicInput = document.getElementById('topic');
        this.questionTypeSelect = document.getElementById('question-type');
        this.numQuestionsSelect = document.getElementById('num-questions');
        this.generateBtn = document.getElementById('generate-btn');

        // Quiz section elements
        this.quizSection = document.getElementById('quiz-section');
        this.quizTitle = document.getElementById('quiz-title');
        this.questionCounter = document.getElementById('question-counter');
        this.quizTypeDisplay = document.getElementById('quiz-type-display');
        this.progressFill = document.getElementById('progress-fill');
        this.questionContainer = document.getElementById('question-container');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.submitBtn = document.getElementById('submit-btn');

        // Results section elements
        this.resultsSection = document.getElementById('results-section');
        this.scorePercentage = document.getElementById('score-percentage');
        this.scoreText = document.getElementById('score-text');
        this.resultsList = document.getElementById('results-list');
        this.tryAgainBtn = document.getElementById('try-again-btn');
        this.newQuizBtn = document.getElementById('new-quiz-btn');

        // Loading overlay
        this.loadingOverlay = document.getElementById('loading-overlay');
    }

    bindEvents() {
        this.generateBtn.addEventListener('click', () => this.generateQuiz());
        this.prevBtn.addEventListener('click', () => this.previousQuestion());
        this.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.submitBtn.addEventListener('click', () => this.submitQuiz());
        this.tryAgainBtn.addEventListener('click', () => this.retryQuiz());
        this.newQuizBtn.addEventListener('click', () => this.startNewQuiz());
    }

    async generateQuiz() {
        const topic = this.topicInput.value.trim();
        const questionType = this.questionTypeSelect.value;
        const numQuestions = this.numQuestionsSelect.value;

        if (!topic || !questionType || !numQuestions) {
            alert('Please fill in all fields');
            return;
        }

        this.showLoading();

        try {
            const response = await fetch(`${this.apiUrl}/generate-quiz`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    topic: topic,
                    question_type: questionType,
                    num_questions: parseInt(numQuestions)
                })
            });

            const data = await response.json();
            
            if (data.success && data.quiz) {
                this.currentQuiz = data.quiz;
                this.userAnswers = new Array(this.currentQuiz.questions.length).fill(null);
                this.currentQuestionIndex = 0;
                this.isSubmitted = false;
                this.selectedMatches = {};
                
                this.showQuizSection();
                this.updateQuizHeader();
                this.displayCurrentQuestion();
            } else {
                throw new Error(data.error || 'Failed to generate quiz');
            }
        } catch (error) {
            console.error('Error generating quiz:', error);
            alert(`Error generating quiz: ${error.message}. Please try again.`);
        } finally {
            this.hideLoading();
        }
    }

    showQuizSection() {
        this.setupSection.classList.add('hidden');
        this.quizSection.classList.remove('hidden');
        this.resultsSection.classList.add('hidden');
    }

    updateQuizHeader() {
        this.quizTitle.textContent = this.currentQuiz.title;
        this.questionCounter.textContent = `Question ${this.currentQuestionIndex + 1} of ${this.currentQuiz.totalQuestions}`;
        
        const typeDisplayMap = {
            'mcq': 'MCQ',
            'multichoice': 'MultiChoice',
            'fillblanks': 'Fill Blanks',
            'match': 'Match Following'
        };
        this.quizTypeDisplay.textContent = typeDisplayMap[this.currentQuiz.type] || this.currentQuiz.type;
        
        const progressPercentage = ((this.currentQuestionIndex + 1) / this.currentQuiz.totalQuestions) * 100;
        this.progressFill.style.width = `${progressPercentage}%`;
    }

    displayCurrentQuestion() {
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        let questionHTML = '';

        switch (this.currentQuiz.type) {
            case 'mcq':
                questionHTML = this.renderMCQQuestion(question);
                break;
            case 'multichoice':
                questionHTML = this.renderMultiChoiceQuestion(question);
                break;
            case 'fillblanks':
                questionHTML = this.renderFillBlanksQuestion(question);
                break;
            case 'match':
                questionHTML = this.renderMatchQuestion(question);
                break;
        }

        this.questionContainer.innerHTML = questionHTML;
        this.updateNavigationButtons();
        this.bindQuestionEvents();
    }

    renderMCQQuestion(question) {
        let optionsHTML = '';
        question.options.forEach((option, index) => {
            const isSelected = this.userAnswers[this.currentQuestionIndex] === index;
            const selectedClass = isSelected ? 'selected' : '';
            const resultClass = this.isSubmitted ? this.getOptionResultClass(index, question.correct, this.userAnswers[this.currentQuestionIndex]) : '';
            
            optionsHTML += `
                <div class="option ${selectedClass} ${resultClass}" data-index="${index}">
                    <input type="radio" name="mcq-${question.id}" value="${index}" ${isSelected ? 'checked' : ''} ${this.isSubmitted ? 'disabled' : ''}>
                    <span>${option}</span>
                </div>
            `;
        });

        return `
            <div class="question">
                <h3>${question.question}</h3>
                <div class="options">
                    ${optionsHTML}
                </div>
            </div>
        `;
    }

    renderMultiChoiceQuestion(question) {
        let optionsHTML = '';
        const selectedAnswers = this.userAnswers[this.currentQuestionIndex] || [];
        
        question.options.forEach((option, index) => {
            const isSelected = selectedAnswers.includes(index);
            const selectedClass = isSelected ? 'selected' : '';
            const resultClass = this.isSubmitted ? this.getMultiChoiceResultClass(index, question.correct, selectedAnswers) : '';
            
            optionsHTML += `
                <div class="option ${selectedClass} ${resultClass}" data-index="${index}">
                    <input type="checkbox" name="multichoice-${question.id}" value="${index}" ${isSelected ? 'checked' : ''} ${this.isSubmitted ? 'disabled' : ''}>
                    <span>${option}</span>
                </div>
            `;
        });

        return `
            <div class="question">
                <h3>${question.question}</h3>
                <div class="options">
                    ${optionsHTML}
                </div>
            </div>
        `;
    }

    renderFillBlanksQuestion(question) {
        const userAnswer = this.userAnswers[this.currentQuestionIndex] || [];
        const parts = question.template.split('_____');
        let questionHTML = '<h3>';
        
        for (let i = 0; i < parts.length; i++) {
            questionHTML += parts[i];
            if (i < parts.length - 1) {
                const value = userAnswer[i] || '';
                const inputClass = this.isSubmitted ? this.getFillBlankResultClass(i, question.blanks, userAnswer) : '';
                questionHTML += `<input type="text" class="fill-blank-input ${inputClass}" data-index="${i}" value="${value}" ${this.isSubmitted ? 'disabled' : ''}>`;
            }
        }
        questionHTML += '</h3>';

        return `<div class="question">${questionHTML}</div>`;
    }

    renderMatchQuestion(question) {
        const userMatches = this.userAnswers[this.currentQuestionIndex] || {};
        
        let leftColumnHTML = '<h4>Match These:</h4>';
        question.leftColumn.forEach(item => {
            const selectedClass = this.selectedMatches.left === item.id ? 'selected' : '';
            const matchedClass = this.isSubmitted && userMatches[item.id] ? 'matched' : '';
            leftColumnHTML += `<div class="match-item ${selectedClass} ${matchedClass}" data-id="${item.id}" data-side="left">${item.text}</div>`;
        });

        let rightColumnHTML = '<h4>With These:</h4>';
        question.rightColumn.forEach(item => {
            const selectedClass = this.selectedMatches.right === item.id ? 'selected' : '';
            const matchedClass = this.isSubmitted && Object.values(userMatches).includes(item.id) ? 'matched' : '';
            rightColumnHTML += `<div class="match-item ${selectedClass} ${matchedClass}" data-id="${item.id}" data-side="right">${item.text}</div>`;
        });

        return `
            <div class="question">
                <h3>${question.question}</h3>
                <div class="match-container">
                    <div class="match-column">
                        ${leftColumnHTML}
                    </div>
                    <div class="match-column">
                        ${rightColumnHTML}
                    </div>
                </div>
            </div>
        `;
    }

    bindQuestionEvents() {
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        
        switch (this.currentQuiz.type) {
            case 'mcq':
                this.bindMCQEvents();
                break;
            case 'multichoice':
                this.bindMultiChoiceEvents();
                break;
            case 'fillblanks':
                this.bindFillBlanksEvents();
                break;
            case 'match':
                this.bindMatchEvents();
                break;
        }
    }

    bindMCQEvents() {
        if (this.isSubmitted) return;
        
        const options = this.questionContainer.querySelectorAll('.option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                const index = parseInt(option.dataset.index);
                this.userAnswers[this.currentQuestionIndex] = index;
                
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                
                const radio = option.querySelector('input');
                radio.checked = true;
            });
        });
    }

    bindMultiChoiceEvents() {
        if (this.isSubmitted) return;
        
        const options = this.questionContainer.querySelectorAll('.option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                const index = parseInt(option.dataset.index);
                let selectedAnswers = this.userAnswers[this.currentQuestionIndex] || [];
                
                if (selectedAnswers.includes(index)) {
                    selectedAnswers = selectedAnswers.filter(i => i !== index);
                    option.classList.remove('selected');
                } else {
                    selectedAnswers.push(index);
                    option.classList.add('selected');
                }
                
                this.userAnswers[this.currentQuestionIndex] = selectedAnswers;
                
                const checkbox = option.querySelector('input');
                checkbox.checked = selectedAnswers.includes(index);
            });
        });
    }

    bindFillBlanksEvents() {
        if (this.isSubmitted) return;
        
        const inputs = this.questionContainer.querySelectorAll('.fill-blank-input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                const index = parseInt(input.dataset.index);
                let answers = this.userAnswers[this.currentQuestionIndex] || [];
                answers[index] = input.value;
                this.userAnswers[this.currentQuestionIndex] = answers;
            });
        });
    }

    bindMatchEvents() {
        if (this.isSubmitted) return;
        
        const matchItems = this.questionContainer.querySelectorAll('.match-item');
        matchItems.forEach(item => {
            item.addEventListener('click', () => {
                const itemId = item.dataset.id;
                const side = item.dataset.side;
                
                // Clear previous selections on the same side
                matchItems.forEach(i => {
                    if (i.dataset.side === side) {
                        i.classList.remove('selected');
                    }
                });
                
                // Select current item
                item.classList.add('selected');
                this.selectedMatches[side] = itemId;
                
                // If both sides selected, create match
                if (this.selectedMatches.left && this.selectedMatches.right) {
                    let userMatches = this.userAnswers[this.currentQuestionIndex] || {};
                    userMatches[this.selectedMatches.left] = this.selectedMatches.right;
                    this.userAnswers[this.currentQuestionIndex] = userMatches;
                    
                    // Clear selections
                    this.selectedMatches = {};
                    matchItems.forEach(i => i.classList.remove('selected'));
                }
            });
        });
    }

    getOptionResultClass(optionIndex, correctIndex, userAnswer) {
        if (optionIndex === correctIndex) {
            return 'correct';
        } else if (optionIndex === userAnswer && optionIndex !== correctIndex) {
            return 'incorrect';
        }
        return '';
    }

    getMultiChoiceResultClass(optionIndex, correctAnswers, userAnswers) {
        const isCorrect = correctAnswers.includes(optionIndex);
        const isSelected = userAnswers.includes(optionIndex);
        
        if (isCorrect) {
            return 'correct';
        } else if (isSelected && !isCorrect) {
            return 'incorrect';
        }
        return '';
    }

    getFillBlankResultClass(index, correctAnswers, userAnswers) {
        const userAnswer = userAnswers[index] || '';
        const correctAnswer = correctAnswers[index] || '';
        
        if (userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()) {
            return 'correct';
        } else {
            return 'incorrect';
        }
    }

    updateNavigationButtons() {
        this.prevBtn.disabled = this.currentQuestionIndex === 0;
        
        if (this.currentQuestionIndex === this.currentQuiz.questions.length - 1) {
            this.nextBtn.classList.add('hidden');
            this.submitBtn.classList.remove('hidden');
        } else {
            this.nextBtn.classList.remove('hidden');
            this.submitBtn.classList.add('hidden');
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.updateQuizHeader();
            this.displayCurrentQuestion();
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.currentQuestionIndex++;
            this.updateQuizHeader();
            this.displayCurrentQuestion();
        }
    }

    submitQuiz() {
        this.isSubmitted = true;
        this.displayResults();
    }

    displayResults() {
        let correctCount = 0;
        const totalQuestions = this.currentQuiz.questions.length;

        // Calculate score
        this.currentQuiz.questions.forEach((question, index) => {
            if (this.isAnswerCorrect(question, this.userAnswers[index], this.currentQuiz.type)) {
                correctCount++;
            }
        });

        const percentage = Math.round((correctCount / totalQuestions) * 100);

        // Update results display
        this.scorePercentage.textContent = `${percentage}%`;
        this.scoreText.textContent = `You scored ${correctCount} out of ${totalQuestions} questions correctly`;

        // Generate results list
        let resultsHTML = '';
        this.currentQuiz.questions.forEach((question, index) => {
            const isCorrect = this.isAnswerCorrect(question, this.userAnswers[index], this.currentQuiz.type);
            const resultClass = isCorrect ? 'correct' : 'incorrect';
            
            resultsHTML += `
                <div class="result-item ${resultClass}">
                    <div class="result-question">Q${index + 1}: ${question.question}</div>
                    <div class="result-answer">
                        ${this.formatResultAnswer(question, this.userAnswers[index], this.currentQuiz.type)}
                    </div>
                </div>
            `;
        });

        this.resultsList.innerHTML = resultsHTML;

        // Show results section
        this.quizSection.classList.add('hidden');
        this.resultsSection.classList.remove('hidden');
    }

    isAnswerCorrect(question, userAnswer, type) {
        switch (type) {
            case 'mcq':
                return userAnswer === question.correct;
            case 'multichoice':
                if (!userAnswer || !Array.isArray(userAnswer)) return false;
                return JSON.stringify(userAnswer.sort()) === JSON.stringify(question.correct.sort());
            case 'fillblanks':
                if (!userAnswer || !Array.isArray(userAnswer)) return false;
                return question.blanks.every((correct, i) => 
                    (userAnswer[i] || '').toLowerCase().trim() === correct.toLowerCase().trim()
                );
            case 'match':
                if (!userAnswer || typeof userAnswer !== 'object') return false;
                return JSON.stringify(userAnswer) === JSON.stringify(question.correct);
            default:
                return false;
        }
    }

    formatResultAnswer(question, userAnswer, type) {
        switch (type) {
            case 'mcq':
                const userChoice = userAnswer !== undefined ? question.options[userAnswer] : 'No answer';
                const correctChoice = question.options[question.correct];
                return `Your answer: ${userChoice}<br>Correct answer: ${correctChoice}`;
            case 'multichoice':
                const userChoices = userAnswer ? userAnswer.map(i => question.options[i]).join(', ') : 'No answer';
                const correctChoices = question.correct.map(i => question.options[i]).join(', ');
                return `Your answers: ${userChoices}<br>Correct answers: ${correctChoices}`;
            case 'fillblanks':
                const userBlanks = userAnswer || [];
                const correctBlanks = question.blanks;
                return `Your answers: ${userBlanks.join(', ')}<br>Correct answers: ${correctBlanks.join(', ')}`;
            case 'match':
                const userMatches = userAnswer || {};
                const correctMatches = question.correct;
                let userMatchStr = Object.entries(userMatches).map(([k, v]) => {
                    const leftItem = question.leftColumn.find(item => item.id === k)?.text || k;
                    const rightItem = question.rightColumn.find(item => item.id === v)?.text || v;
                    return `${leftItem} → ${rightItem}`;
                }).join(', ');
                let correctMatchStr = Object.entries(correctMatches).map(([k, v]) => {
                    const leftItem = question.leftColumn.find(item => item.id === k)?.text || k;
                    const rightItem = question.rightColumn.find(item => item.id === v)?.text || v;
                    return `${leftItem} → ${rightItem}`;
                }).join(', ');
                return `Your matches: ${userMatchStr}<br>Correct matches: ${correctMatchStr}`;
            default:
                return 'Unknown question type';
        }
    }

    retryQuiz() {
        // Reset quiz state
        this.userAnswers = new Array(this.currentQuiz.questions.length).fill(null);
        this.currentQuestionIndex = 0;
        this.isSubmitted = false;
        this.selectedMatches = {};
        
        // Show quiz section
        this.resultsSection.classList.add('hidden');
        this.quizSection.classList.remove('hidden');
        
        // Update display
        this.updateQuizHeader();
        this.displayCurrentQuestion();
    }

    startNewQuiz() {
        // Reset everything
        this.currentQuiz = null;
        this.userAnswers = [];
        this.currentQuestionIndex = 0;
        this.isSubmitted = false;
        this.selectedMatches = {};
        
        // Clear form
        this.topicInput.value = '';
        this.questionTypeSelect.value = '';
        this.numQuestionsSelect.value = '';
        
        // Show setup section
        this.resultsSection.classList.add('hidden');
        this.quizSection.classList.add('hidden');
        this.setupSection.classList.remove('hidden');
    }

    showLoading() {
        this.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});