package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationCategory;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.data.mongodb.core.mapping.Field;

@Getter
@AllArgsConstructor
public class CategoryCount {
    @Field("_id")
    private final NotificationCategory category;
    private final long count;
}
