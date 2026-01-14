package com.openframe.data.document.auth;

import com.openframe.data.document.user.User;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;

/**
 * User model for multi-tenant Authorization Server with domain-based tenancy
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@CompoundIndex(
        def = "{'tenantId': 1, 'email': 1}",
        unique = true,
        partialFilter = "{ 'tenantId': { $exists: true } }"
)
public class AuthUser extends User {

    @Indexed
    private String tenantId;

    private String passwordHash;

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