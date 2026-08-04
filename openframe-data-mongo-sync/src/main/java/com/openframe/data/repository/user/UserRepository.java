package com.openframe.data.repository.user;

import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String>, BaseUserRepository<Optional<User>, Boolean, String>, CustomUserRepository {
    @Override
    Optional<User> findByEmail(String email);

    @Override
    Boolean existsByEmail(String email);

    @Override
    Boolean existsByEmailAndStatus(String email, UserStatus status);

    List<User> findByRolesInAndStatus(Collection<UserRole> roles, UserStatus status);

    /**
     * Whether a user with the given id is a member of the given tenant. Tenant-first form so the
     * shared/SaaS side (which bypasses the tenant aspect) can scope by tenant explicitly — e.g. to
     * tell a real tenant member apart from a cross-tenant super user.
     */
    boolean existsByTenantIdAndId(String tenantId, String id);
}
