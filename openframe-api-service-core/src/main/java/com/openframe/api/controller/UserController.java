package com.openframe.api.controller;

import com.openframe.api.dto.user.UpdateUserRequest;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.dto.user.UserPageResponse;
import com.openframe.api.service.user.UserService;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public UserPageResponse listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return userService.listUsers(page, size);
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public UserResponse getUserById(@PathVariable String id) {
        return userService.getUserById(id);
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public UserResponse updateUserById(
            @PathVariable String id,
            @Valid @RequestBody UpdateUserRequest request
    ) {
        return userService.updateUser(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable String id,
                           @AuthenticationPrincipal AuthPrincipal principal) {
        userService.softDeleteUser(id, principal.getId());
    }

    @DeleteMapping("/{id}/purge")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void purgeUser(@PathVariable String id) {
        userService.purgeUser(id);
    }

    @PostMapping("/{id}/transfer-ownership")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('OWNER')")
    public void transferOwnership(@PathVariable String id,
                                  @AuthenticationPrincipal AuthPrincipal principal) {
        userService.transferOwnership(id, principal.getId());
    }
}


