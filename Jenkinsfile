pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify') {
            steps {
                sh 'pwd'
                sh 'ls -la'
            }
        }
        stage('Environment') {
            steps {
                sh 'echo $PATH'
                sh 'which node || true'
                sh 'which npm || true'
            }
        }
        stage('Install Dependencies') {
            steps {
                dir('order-service') {
                    sh 'npm install'
                }
            }
        }
    }
}