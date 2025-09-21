# OpenFrame Core Library

The OpenFrame Core library contains shared code used across multiple microservices in the platform.

## Usage
• Added as a Maven/Gradle dependency in other services (like openframe-api, openframe-stream, etc.).  
• Provides a consistent code foundation to avoid duplication of core logic.

## Development
• Make changes here carefully to avoid breaking dependent services.  
• Run mvn clean install to publish updates to the local Maven repo.  
• Review version numbers to ensure services can pick up updates.

## Testing
• Use JUnit or similar frameworks for any shared logic.  
• If integration tests exist, they may rely on ephemeral test containers or local test DBs.
