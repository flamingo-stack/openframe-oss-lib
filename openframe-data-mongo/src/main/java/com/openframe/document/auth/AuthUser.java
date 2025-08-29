package com.openframe.document.auth;

import com.openframe.document.user.User;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * User model for multi-tenant Authorization Server with domain-based tenancy
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@Document(collection = "users")
@CompoundIndex(def = "{'tenantId': 1, 'email': 1}", unique = true)
public class AuthUser extends User {

    @Indexed
    private String tenantId;

    @Indexed
    private String tenantDomain;

    private String passwordHash;

    private boolean emailVerified = false;

    private String loginProvider; // LOCAL, GOOGLE, etc.
    private String externalUserId;

    private Instant lastLogin;

    public String getFullName() {
        if (super.getFirstName() != null && super.getLastName() != null) {
            return super.getFirstName() + " " + super.getLastName();
        } else if (super.getFirstName() != null) {
            return super.getFirstName();
        } else if (super.getLastName() != null) {
            return super.getLastName();
        } else {
            return super.getEmail();
        }
    }
}