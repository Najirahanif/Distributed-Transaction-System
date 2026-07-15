pipeline {
    agent any

    tools {
        nodejs 'Node-22'
    }

    environment {
        PORT = '3001'
        CLIENT_ID = 'order-service'
        KAFKA_BROKER = 'kafka:9092'
        KAFKAJS_NO_PARTITIONER_WARNING = '1'
        MONGO_URI = credentials('order-mongo-uri')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify Workspace') {
            steps {
                sh 'pwd'
                sh 'ls -la'
            }
        }

        stage('Verify Node Environment') {
            steps {
                sh 'echo "Node Version:"'
                sh 'node -v'

                sh 'echo "NPM Version:"'
                sh 'npm -v'

                sh 'echo "Node Location:"'
                sh 'which node'

                sh 'echo "NPM Location:"'
                sh 'which npm'
            }
        }

        stage('Create .env File') {
            steps {
                dir('order-service') {
                    writeFile file: '.env', text: """
PORT=${PORT}
CLIENT_ID=${CLIENT_ID}
KAFKA_BROKER=${KAFKA_BROKER}
KAFKAJS_NO_PARTITIONER_WARNING=${KAFKAJS_NO_PARTITIONER_WARNING}
MONGO_URI=${MONGO_URI}
"""
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('order-service') {
                    sh 'npm install'
                }
            }
        }

        stage('Verify .env File') {
            steps {
                dir('order-service') {
                    sh 'ls -la .env'
                }
            }
        }

        stage('Verify Application') {
            steps {
                dir('order-service') {
                    sh 'node --check src/server.js'
                }
            }
        }
    }
}