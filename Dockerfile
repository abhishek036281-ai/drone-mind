# Use lightweight stable official python image
FROM python:3.11-slim

# Set working directory inside container
WORKDIR /app

# Install dependencies first to utilize Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy complete project code
COPY . .

# Expose default application port
EXPOSE 8000

# Run unified FastAPI backend which serves front-end static files
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
