package com.openframe.data.cassandra.config;

import lombok.Data;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

@Table("synced_rows")
@Data
class SyncedRow {

    @PrimaryKey
    private String id;

    @Column("kept_column")
    private String keptColumn;

    @Column("added_column")
    private String addedColumn;

    @Column("other_added_column")
    private String otherAddedColumn;
}
