# ReactiveOAuthClientRepository Documentation

## Overview
The `ReactiveOAuthClientRepository` interface is a reactive repository for managing OAuth clients in a MongoDB database.

## Methods
- **findByClientId(String clientId)**: Finds an OAuth client by its client ID, returning a `Mono<OAuthClient>`.