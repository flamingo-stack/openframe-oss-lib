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
public interface UserRepository extends MongoRepository<User, String>, BaseUserRepository<Optional<User>, Boolean, String> {
    @Override
    Optional<User> findByEmail(String email);

    @Override
    Boolean existsByEmail(String email);

    @Override
    Boolean existsByEmailAndStatus(String email, UserStatus status);

    /**
     * Lookup used by notification fan-out to enumerate the recipients of an
     * admin-targeted broadcast (e.g. "tell every active admin/owner about
     * this approval request"). Per-tenant deployments mean "every admin in
     * the current Mongo database" is exactly the tenant's admin set.
     */
    List<User> findByRolesInAndStatus(Collection<UserRole> roles, UserStatus status);
}
