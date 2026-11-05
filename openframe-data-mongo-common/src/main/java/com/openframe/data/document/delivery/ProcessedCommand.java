package com.openframe.data.document.delivery;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "processed_commands")
public class ProcessedCommand {

    @Id
    private String dispatchId;

    @Indexed(name = "processed_commands_ttl", expireAfter = "4d")
    private Instant handledAt;
}
