@echo off
call C:\Users\sabdu\anaconda3\envs\llms\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000