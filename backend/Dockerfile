FROM node:18-bullseye-slim

WORKDIR /app

RUN apt-get update && apt-get install -y build-essential python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . ./

EXPOSE 3000
CMD ["npm","start"]
