from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import ollama
import shutil
import re
import os
import logging
from pdfminer.high_level import extract_text
from fuzzywuzzy import process  # For basic text matching
from langchain_community.chat_models import ChatOpenAI
from langchain.schema import HumanMessage
import os

app = FastAPI()
logging.basicConfig(level=logging.INFO)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)
pdf_data_store = {}

class MessageRequest(BaseModel):
    data: str
    llm: str

def retrieve_relevant_sections(query, sections, top_n=3):
    """
    Retrieve the most relevant sections based on a user's query.
    """
    if not sections:
        return "No document content available."

    section_names = list(sections.keys())
    section_texts = list(sections.values())

    matched_section_names = process.extract(query, section_names, limit=top_n)
    print(matched_section_names)
    relevant_texts = [sections[match[0]] for match in matched_section_names]

    if not relevant_texts or len(" ".join(relevant_texts)) < 50:
        matched_texts = process.extract(query, section_texts, limit=top_n)
        relevant_texts.extend([match[0] for match in matched_texts])

    return "\n\n".join(relevant_texts[:top_n])

def extract_with_deepseek(text: str, MODEL: str = "deepseek-r1:7b"):
    """Extract entities using DeepSeek."""
    try:
        print("deepseeeek")
        response = ollama.chat(model=MODEL, messages=[
            {
                "role": "user",
                "content": text
            }
        ])
        print(response["message"]["content"])
        return response["message"]["content"]
    except Exception as e:
        raise RuntimeError(f"DeepSeek extraction failed: {str(e)}")    

def extract_with_gpt(text: str, model: str = "gpt-4o-turbo"):
    """Extract entities using GPT via LangChain."""
    try:
        # llm = ChatOpenAI(model_name=model, openai_api_key=os.getenv("OPENAI_API_KEY"))

        # prompt = text

        # response = llm.invoke([HumanMessage(content=prompt)])

        # return response.content
        return "UNCOMMENT CODE FOR GPT"
    except Exception as e:
        raise RuntimeError(f"GPT extraction failed: {str(e)}")

def extract_with_llm(text: str, model: str):
    """Route text to the appropriate LLM based on the model name."""
    if model.lower() == 'ollama':
        return extract_with_ollama(text)
    elif model.lower() == "gpt":
        return extract_with_gpt(text)
    elif model.lower() == "deepseek":
        return extract_with_deepseek(text)
    else:
        raise ValueError(f"Unknown model: {model}")

def extract_with_ollama(text: str, model: str = "llama3.2"):
    """
    Extract information using Ollama's LLM.
    """
    try:
        print("LLAMAAAA")
        response = ollama.chat(model=model, messages=[{"role": "user", "content": text}])
        return response["message"]["content"]
    except Exception as e:
        logging.error(f"Ollama extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process text with Ollama.")

def summarize_with_ollama(text: str, model: str = "llama3.2"):
    """
    Summarize a research paper section using Ollama.
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")

    prompt = (
        "You are an AI assistant specialized in summarizing research papers. "
        "Generate a concise and clear summary that captures the main findings, objectives, and contributions.\n\n"
        f"Research Paper Section:\n{text}\n\nSummary:"
    )

    try:
        response = ollama.chat(model=model, messages=[{"role": "user", "content": prompt}])
        return response["message"]["content"]
    except Exception as e:
        logging.error(f"Failed to generate summary with Ollama: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate summary.")

@app.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload and process a PDF file.
    """
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        sections = extract_sections(file_path)
        pdf_data_store[file.filename] = sections

        summary = summarize_with_ollama(sections.get("Preamble", ""))
        return {"file_path": file_path, "summary": summary}
    except Exception as e:
        logging.error(f"File upload error: {str(e)}")
        raise HTTPException(status_code=500, detail="File processing failed.")

@app.post("/process-message")
async def process_message(message: MessageRequest):
    """
    Process user message with relevant sections.
    """
    try:
        if not pdf_data_store:
            llm_response = extract_with_llm(message.data, message.llm)
            return {"response": llm_response}
        
        print(message.llm)
        latest_file = list(pdf_data_store.keys())[-1]
        relevant_text = retrieve_relevant_sections(message.data, pdf_data_store[latest_file])
        llm_response = extract_with_ollama(f"Context:\n{relevant_text}\n\nQuestion: {message.data}")
        return {"response": llm_response}
    except Exception as e:
        logging.error(f"Message processing error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process message.")

@app.get("/")
async def root():
    """
    Root endpoint.
    """
    return {"message": "FastAPI backend is running!"}

def extract_sections(pdf_path):
    """
    Extract structured sections from a PDF document.
    """
    text = extract_text(pdf_path)
    text = text.replace('\r', '\n')
    lines = [line.strip() for line in text.split('\n') if line.strip()]

    common_headings = {
        "abstract", "introduction", "background", "related work",
        "literature review", "methods", "methodology", "experiments",
        "results", "discussion", "conclusion", "acknowledgements",
        "acknowledgments", "references"
    }

    numbered_heading_pattern = re.compile(r'^(?P<num>\d+(?:\.\d+)*)(?:[\.\)])?\s+(?P<title>[A-Z].{0,100})$')

    sections = {}
    current_section = None
    current_text_lines = []

    for line in lines:
        if re.fullmatch(r'[\d\.,]+', line):
            continue

        is_heading = False
        heading_title = None

        match = numbered_heading_pattern.match(line)
        if match:
            candidate = match.group('title').strip()
            if len(candidate) >= 3 and len(candidate.split()) <= 8:
                is_heading = True
                heading_title = candidate

        if not is_heading and line.lower() in common_headings and len(line) >= 3:
            is_heading = True
            heading_title = line

        if not is_heading and line.isupper() and len(line.split()) < 10:
            is_heading = True
            heading_title = line.title()

        if is_heading and not match:
            words = line.split()
            if len(words) > 8 or (',' in line and len(words) > 4):
                is_heading = False

        if is_heading:
            if current_section:
                sections[current_section] = "\n".join(current_text_lines)
            else:
                if current_text_lines:
                    sections["Preamble"] = "\n".join(current_text_lines)

            current_section = heading_title
            current_text_lines = []
        else:
            current_text_lines.append(line)

    if current_section:
        sections[current_section] = "\n".join(current_text_lines)
    else:
        sections["Full Text"] = "\n".join(current_text_lines)

    return sections
