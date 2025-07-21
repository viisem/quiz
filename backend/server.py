from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Union, Dict, Any
import uuid
from datetime import datetime
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json
import re


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Gemini API key
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

# Create the main app without a prefix
app = FastAPI()

# Mount static files for the HTML app
app.mount("/static", StaticFiles(directory="/app/frontend/public"), name="static")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class QuizRequest(BaseModel):
    topic: str
    question_type: str  # mcq, multichoice, fillblanks, match
    num_questions: int

class QuizQuestion(BaseModel):
    id: int
    question: str
    options: Optional[List[str]] = None
    correct: Union[int, List[int], List[str], Dict[str, str]] = None
    blanks: Optional[List[str]] = None
    template: Optional[str] = None
    leftColumn: Optional[List[Dict[str, str]]] = None
    rightColumn: Optional[List[Dict[str, str]]] = None
    explanation: Optional[str] = None

class Quiz(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    type: str
    questions: List[QuizQuestion]
    totalQuestions: int

class QuizResponse(BaseModel):
    success: bool
    quiz: Optional[Quiz] = None
    error: Optional[str] = None


def create_gemini_chat():
    """Create a new Gemini chat instance"""
    if not GEMINI_API_KEY:
        raise ValueError("Gemini API key not found")
    
    session_id = str(uuid.uuid4())
    system_message = """You are an expert quiz generator. Create educational quiz questions based on the given topic and question type.

IMPORTANT FORMATTING RULES:
1. Always respond with valid JSON only
2. No markdown formatting, no code blocks, just raw JSON
3. Use double quotes for all strings
4. Ensure all JSON is properly escaped

For each question type, follow these exact formats:

MCQ (Single Answer):
{
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of the correct answer"
    }
  ]
}

MULTICHOICE (Multiple Answers):
{
  "questions": [
    {
      "id": 1,
      "question": "Question text here? (Select all that apply)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": [0, 2],
      "explanation": "Brief explanation of the correct answers"
    }
  ]
}

FILLBLANKS:
{
  "questions": [
    {
      "id": 1,
      "question": "Question with _____ and _____ blanks.",
      "blanks": ["answer1", "answer2"],
      "template": "Question with _____ and _____ blanks.",
      "explanation": "Brief explanation"
    }
  ]
}

MATCH:
{
  "questions": [
    {
      "id": 1,
      "question": "Match the following items:",
      "leftColumn": [
        {"id": "item1", "text": "Left item 1"},
        {"id": "item2", "text": "Left item 2"}
      ],
      "rightColumn": [
        {"id": "match1", "text": "Right item 1"},
        {"id": "match2", "text": "Right item 2"}
      ],
      "correct": {
        "item1": "match1",
        "item2": "match2"
      },
      "explanation": "Brief explanation"
    }
  ]
}

Make questions challenging but fair, educational, and relevant to the topic."""

    chat = LlmChat(
        api_key=GEMINI_API_KEY,
        session_id=session_id,
        system_message=system_message
    )
    
    # Configure for Gemini
    chat.with_model("gemini", "gemini-1.5-flash-8b")
    chat.with_max_tokens(4096)
    
    return chat


def parse_gemini_response(response_text: str, question_type: str) -> List[QuizQuestion]:
    """Parse Gemini response into QuizQuestion objects"""
    try:
        # Clean the response - remove any markdown formatting
        cleaned_response = response_text.strip()
        if cleaned_response.startswith('```json'):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.endswith('```'):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()
        
        # Parse JSON
        data = json.loads(cleaned_response)
        
        questions = []
        for i, q_data in enumerate(data.get('questions', [])):
            question = QuizQuestion(
                id=i + 1,
                question=q_data['question'],
                explanation=q_data.get('explanation', '')
            )
            
            if question_type == 'mcq':
                question.options = q_data['options']
                question.correct = q_data['correct']
            elif question_type == 'multichoice':
                question.options = q_data['options']
                question.correct = q_data['correct']
            elif question_type == 'fillblanks':
                question.blanks = q_data['blanks']
                question.template = q_data['template']
            elif question_type == 'match':
                question.leftColumn = q_data['leftColumn']
                question.rightColumn = q_data['rightColumn']
                question.correct = q_data['correct']
            
            questions.append(question)
        
        return questions
    
    except json.JSONDecodeError as e:
        logging.error(f"JSON decode error: {e}")
        logging.error(f"Raw response: {response_text}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        logging.error(f"Error parsing response: {e}")
        raise HTTPException(status_code=500, detail="Error processing AI response")


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

@api_router.post("/generate-quiz", response_model=QuizResponse)
async def generate_quiz(request: QuizRequest):
    """Generate a quiz using Gemini AI"""
    try:
        # Validate request
        if not request.topic.strip():
            raise HTTPException(status_code=400, detail="Topic is required")
        
        if request.question_type not in ['mcq', 'multichoice', 'fillblanks', 'match']:
            raise HTTPException(status_code=400, detail="Invalid question type")
        
        if request.num_questions < 1 or request.num_questions > 15:
            raise HTTPException(status_code=400, detail="Number of questions must be between 1 and 15")
        
        # Create Gemini chat
        chat = create_gemini_chat()
        
        # Create prompt based on question type
        type_descriptions = {
            'mcq': 'multiple choice questions with 4 options and only one correct answer',
            'multichoice': 'multiple choice questions with 4 options where multiple answers can be correct',
            'fillblanks': 'fill in the blanks questions with 1-3 blanks per question',
            'match': 'matching questions where items from left column match with right column items'
        }
        
        prompt = f"""Generate {request.num_questions} {type_descriptions[request.question_type]} about the topic: {request.topic}

Topic: {request.topic}
Question Type: {request.question_type}
Number of Questions: {request.num_questions}

Generate educational, challenging questions that test understanding of {request.topic}. 
Return ONLY valid JSON following the exact format specified in your instructions."""

        # Send request to Gemini
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        logging.info(f"Gemini response: {response}")
        
        # Parse response
        questions = parse_gemini_response(response, request.question_type)
        
        if not questions:
            raise HTTPException(status_code=500, detail="No questions generated")
        
        # Create quiz object
        quiz = Quiz(
            title=f"{request.topic} Quiz",
            type=request.question_type,
            questions=questions[:request.num_questions],  # Ensure we don't exceed requested count
            totalQuestions=len(questions[:request.num_questions])
        )
        
        # Store quiz in database
        await db.quizzes.insert_one(quiz.dict())
        
        return QuizResponse(success=True, quiz=quiz)
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating quiz: {e}")
        return QuizResponse(success=False, error=str(e))


# Serve the HTML app at root
@app.get("/", response_class=HTMLResponse)
async def serve_quiz_app():
    """Serve the HTML quiz app"""
    html_path = Path("/app/frontend/public/index.html")
    if html_path.exists():
        return HTMLResponse(content=html_path.read_text())
    else:
        return HTMLResponse(content="<h1>Quiz app not found</h1>", status_code=404)


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()