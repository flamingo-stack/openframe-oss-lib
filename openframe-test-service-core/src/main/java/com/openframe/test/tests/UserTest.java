package com.openframe.test.tests;

import com.openframe.test.api.UserApi;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.dto.user.UserRole;
import com.openframe.test.data.dto.user.UserStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("users")
@DisplayName("Users")
public class UserTest {

    @Tag("read")
    @Test
    @DisplayName("List users")
    public void testListUsers() {
        List<AuthUser> users = UserApi.getUsers();
        assertThat(users).allSatisfy(user -> {
            assertThat(user.getId()).as("User id should not be empty").isNotEmpty();
            assertThat(user.getEmail()).as("User email should not be empty").isNotEmpty();
            assertThat(user.getFirstName()).as("User firstName should not be empty").isNotEmpty();
            assertThat(user.getLastName()).as("User lastName should not be empty").isNotEmpty();
            assertThat(user.getRoles()).as("User roles should not be empty").isNotEmpty();
            assertThat(user.getStatus()).as("User status should not be null").isNotNull();
            assertThat(user.getUpdatedAt()).as("User updatedAt should not be null").isNotNull();
        });
    }

    @Tag("read")
    @Test
    @DisplayName("Get user")
    public void testGetUsers() {
        List<AuthUser> users = UserApi.getUsers();
        AuthUser user = UserApi.getUser(users.getFirst().getId());
        assertThat(user).as("Retrieved user should match listed user").isEqualTo(users.getFirst());
    }

    @Tag("delete")
    @Test
    @DisplayName("Delete Admin User")
    public void testDeleteUser() {
        List<AuthUser> users = UserApi.getUsers(UserRole.ADMIN);
        assertThat(users).as("No active Admin users").isNotEmpty();
        int statusCode = UserApi.deleteUser(users.getFirst().getId());
        assertThat(statusCode).as("Delete user status code should be 204").isEqualTo(204);
        AuthUser deletedUser = UserApi.getUser(users.getFirst().getId());
        assertThat(deletedUser).as("User is not found").isNotNull();
        assertThat(deletedUser.getStatus()).as("User status should be DELETED").isEqualTo(UserStatus.DELETED);
    }

    @Tag("delete")
    @Test
    @DisplayName("Check that Owner User cannot be deleted")
    public void testDeleteOwner() {
        List<AuthUser> users = UserApi.getUsers(UserRole.OWNER);
        assertThat(users).as("No active Admin users").isNotEmpty();
        int statusCode = UserApi.deleteUser(users.getFirst().getId());
        assertThat(statusCode).as("Delete owner status code should be 409").isEqualTo(409);
        AuthUser deletedUser = UserApi.getUser(users.getFirst().getId());
        assertThat(deletedUser).as("User is not found").isNotNull();
        assertThat(deletedUser.getStatus()).as("Owner status should remain ACTIVE").isEqualTo(UserStatus.ACTIVE);
    }
}
