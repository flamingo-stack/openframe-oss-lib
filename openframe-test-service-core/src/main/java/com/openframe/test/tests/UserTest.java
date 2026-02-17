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
            assertThat(user.getId()).isNotEmpty();
            assertThat(user.getEmail()).isNotEmpty();
            assertThat(user.getFirstName()).isNotEmpty();
            assertThat(user.getLastName()).isNotEmpty();
            assertThat(user.getRoles()).isNotEmpty();
            assertThat(user.getStatus()).isNotNull();
            assertThat(user.getUpdatedAt()).isNotNull();
        });
    }

    @Tag("read")
    @Test
    @DisplayName("Get user")
    public void testGetUsers() {
        List<AuthUser> users = UserApi.getUsers();
        AuthUser user = UserApi.getUser(users.getFirst().getId());
        assertThat(user).isEqualTo(users.getFirst());
    }

    @Tag("delete")
    @Test
    @DisplayName("Delete Admin User")
    public void testDeleteUser() {
        List<AuthUser> users = UserApi.getUsers(UserRole.ADMIN);
        assertThat(users).as("No active Admin users").isNotEmpty();
        int statusCode = UserApi.deleteUser(users.getFirst().getId());
        assertThat(statusCode).isEqualTo(204);
        AuthUser deletedUser = UserApi.getUser(users.getFirst().getId());
        assertThat(deletedUser).as("User is not found").isNotNull();
        assertThat(deletedUser.getStatus()).isEqualTo(UserStatus.DELETED);
    }

    @Tag("delete")
    @Test
    @DisplayName("Check that Owner User cannot be deleted")
    public void testDeleteOwner() {
        List<AuthUser> users = UserApi.getUsers(UserRole.OWNER);
        assertThat(users).as("No active Admin users").isNotEmpty();
        int statusCode = UserApi.deleteUser(users.getFirst().getId());
        assertThat(statusCode).isEqualTo(409);
        AuthUser deletedUser = UserApi.getUser(users.getFirst().getId());
        assertThat(deletedUser).as("User is not found").isNotNull();
        assertThat(deletedUser.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }
}
