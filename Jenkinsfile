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
                sh 'node -v'
                sh 'npm -v'
                sh 'which node'
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

        stage('Build Docker Image') {
            steps {
                dir('order-service') {
                    sh 'docker build -t order-service:1.0 .'
                }
            }
        }

        stage('Run Docker Container') {
            steps {
                sh '''
                docker rm -f order-service-container || true
                docker run -d \
                    --name order-service-container \
                    -p 3001:3001 \
                    order-service:1.0
                '''
            }
        }

        stage('Verify Container') {
            steps {
                sh 'docker ps'
            }
        }
    }

    post {

        always {
            echo 'Pipeline Finished'
        }

        success {
            echo 'Order Service Pipeline Completed Successfully'
        }

        failure {
            echo 'Order Service Pipeline Failed'
        }

        cleanup {
            sh 'docker rm -f order-service-container || true'
        }
    }
}