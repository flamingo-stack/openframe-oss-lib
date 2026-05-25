package com.openframe.data.document.user.filter;

import com.openframe.data.document.user.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserQueryFilter {
    private String emailRegex;
    private String nameRegex;
    private UserStatus status;
}
