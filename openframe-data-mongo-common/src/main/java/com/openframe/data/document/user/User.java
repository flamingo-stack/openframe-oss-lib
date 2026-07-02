package com.openframe.data.document.user;
import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.experimental.SuperBuilder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.ArrayList;
import java.util.List;
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class User implements TenantScoped {
    @Id
    private String id;
    @Indexed
    private String tenantId;
    @Indexed
    private String email;
    private String firstName;
    private String lastName;
    @Builder.Default
    private List<UserRole> roles = new ArrayList<>();
    /**
     * Indicates whether the user's email is verified.
     * For SSO users this is typically true on first login.
     */
    @Builder.Default
    private boolean emailVerified = false;
    @Indexed
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;
    /**
     * CRM (HubSpot) contact sync flag. null/false means the user needs to be (re)synced to the CRM;
     * set to true by the sync job after a successful sync, and reset to false whenever the user
     * changes. New users start as null so they are picked up automatically.
     */
    private Boolean crmSynced;
    @CreatedDate
    private LocalDateTime createdAt;
    @LastModifiedDate
    private LocalDateTime updatedAt;
    public void setEmail(String email) {
        this.email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
