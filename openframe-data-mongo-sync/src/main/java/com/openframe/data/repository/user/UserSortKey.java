package com.openframe.data.repository.user;

import java.time.LocalDateTime;

// createdAt is not unique, so the row id breaks ties; a row with no createdAt sorts last.
public record UserSortKey(LocalDateTime createdAt, String id) {
}
