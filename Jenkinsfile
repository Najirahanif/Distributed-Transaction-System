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
        stage('Install Dependencies') {
            steps {
                dir('order-service') {
                    sh 'npm install'
                }
            }
        }
    }
}