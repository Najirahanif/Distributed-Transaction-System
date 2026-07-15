pipeline {
    agent any

    tools {
        nodejs 'Node-22'
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

        stage('Install Dependencies') {
            steps {
                dir('order-service') {
                    sh 'npm install'
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