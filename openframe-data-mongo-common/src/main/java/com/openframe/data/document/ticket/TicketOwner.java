package com.openframe.data.document.ticket;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.mapping.Field;

@Data
@NoArgsConstructor
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = ClientTicketOwner.class, name = "CLIENT"),
    @JsonSubTypes.Type(value = AdminTicketOwner.class, name = "ADMIN")
})
public abstract class TicketOwner {

    @Field("ticketOwnerType")
    protected TicketOwnerType type;
}
