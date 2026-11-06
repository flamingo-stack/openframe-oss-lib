package com.openframe.data.repository.user.publishing;

import com.openframe.data.document.user.User;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

// AuthUser extends User, so AuthUserRepository publishes with this spec too.
@Component
@RequiredArgsConstructor
public class UserAggregateSpec implements AggregateSpec<User, UserEvent> {

    public static final String TYPE = "users";

    private final UserOnTicketsProjection userOnTickets;

    @Override
    public String getType() {
        return TYPE;
    }

    @Override
    public UserEvent toEvent(User user) {
        return UserEvent.builder()
                .userId(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .build();
    }

    @Override
    public List<Projection<UserEvent, ?>> projections() {
        return List.of(userOnTickets);
    }
}
