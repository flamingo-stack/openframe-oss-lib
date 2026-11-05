package com.openframe.api.controller;

import com.openframe.api.dto.user.UpdateUserRequest;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.dto.user.UserPageResponse;
import com.openframe.api.service.user.UserService;
import com.openframe.audit.AuditCapture;
import com.openframe.audit.Audited;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

import static com.openframe.data.document.audit.AuditAction.USER_DELETE;
import static com.openframe.data.document.audit.AuditAction.USER_OWNERSHIP_TRANSFER;
import static com.openframe.data.document.audit.AuditAction.USER_OWN_ACCOUNT_DELETE;
import static com.openframe.data.document.audit.AuditAction.USER_UPDATE;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AuditCapture auditCapture;

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
    @Audited(action = USER_UPDATE, targetId = "#id")
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
        AuditAction action = id.equals(principal.getId()) ? USER_OWN_ACCOUNT_DELETE : USER_DELETE;
        auditCapture.run(action, id, () -> userService.softDeleteUser(id, principal.getId()));
    }

    @PostMapping("/{id}/transfer-ownership")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('OWNER')")
    @Audited(action = USER_OWNERSHIP_TRANSFER, targetId = "#id")
    public void transferOwnership(@PathVariable String id,
                                  @AuthenticationPrincipal AuthPrincipal principal) {
        userService.transferOwnership(id, principal.getId());
    }
}


