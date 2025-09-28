package com.openframe.security.authentication;

/**
 * Actor type for authentication - determines if the principal is an admin user or agent machine
 */
public enum ActorType {
    /**
     * Admin user with full access rights
     */
    ADMIN,
    
    /**
     * Agent machine with limited access rights
     */
    AGENT
}