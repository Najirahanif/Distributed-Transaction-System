pipeline {
    agent any

    tools {
        nodejs 'Node-22'
    }

    environment {
        // Make Docker available to Jenkins
        PATH = "/usr/local/bin:${env.PATH}"

        // Order Service Environment Variables
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

        stage('Verify Docker Environment') {
            steps {
                sh 'echo $PATH'
                sh 'which docker'
                sh 'docker --version'
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
        stage('Login to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-hub',  // token named dockmer-hub will be stored in the jenkin credentials
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                    '''
                }
            }
        }

        stage('Tag Docker Image') {
            steps {
                sh 'docker tag order-service:1.0 najira/order-service:1.0'
            }
        }

        stage('Push Docker Image') {
            steps {
                sh 'docker push najira/order-service:1.0'
            }
        }
        stage('Deploy Kafka') {
            steps {
                dir('order-service') {
                    sh '''
                        kubectl apply -f kubernetes/kafka-deployment.yaml
                        kubectl apply -f kubernetes/kafka-service.yaml
                    '''
                }
            }
        }

        stage('Wait for Kafka') {
            steps {
                sh '''
                    kubectl rollout status deployment/kafka -n ecommerce
                '''
            }
        }

        stage('Deploy Order Service') {
            steps {
                dir('order-service') {
                    sh '''
                        kubectl apply -f kubernetes/order-deployment.yaml
                        kubectl apply -f kubernetes/order-service.yaml
                    '''
                }
            }
        }

        stage('Wait for Order Service') {
            steps {
                sh '''
                    kubectl rollout status deployment/order-service -n ecommerce
                '''
            }
        }

        stage('Verify Kubernetes Resources') {
            steps {
                sh '''
                    echo "===== Deployments ====="
                    kubectl get deployments -n ecommerce

                    echo "===== Pods ====="
                    kubectl get pods -n ecommerce

                    echo "===== Services ====="
                    kubectl get svc -n ecommerce
                '''
            }
        }

        stage('Application Logs') {
            steps {
                sh '''
                    POD=$(kubectl get pods -n ecommerce -l app=order-service -o jsonpath="{.items[0].metadata.name}")
                    kubectl logs $POD -n ecommerce --tail=30
                '''
            }
        }
    }

    post {

        success {
            echo 'Pipeline completed successfully.'
        }

        failure {
            echo 'Pipeline failed.'
        }

        always {
            echo 'Cleaning up...'
            sh 'docker rm -f order-service-container || true'
        }
    }
}