package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addQueryHistoryMigrations(mg *Migrator) {
	queryHistoryV1 := Table{
		Name: "query_history",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "datasource_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "created_by", Type: DB_Int, Nullable: false},
			{Name: "created_at", Type: DB_Int, Nullable: false},
			{Name: "comment", Type: DB_Text, Nullable: false},
			{Name: "queries", Type: DB_Text, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "created_by", "datasource_uid"}},
		},
	}

	mg.AddMigration("create query_history table v1", NewAddTableMigration(queryHistoryV1))

	mg.AddMigration("add index query_history.org_id-created_by-datasource_uid", NewAddIndexMigration(queryHistoryV1, queryHistoryV1.Indices[0]))

	mg.AddMigration("alter table query_history alter column created_by type to bigint", NewRawSQLMigration("").
		Mysql("ALTER TABLE query_history MODIFY created_by BIGINT;").
		Postgres("ALTER TABLE query_history ALTER COLUMN created_by TYPE BIGINT;"))

	// TODO: maybe nullable false and default to 0?
	// TODO: maybe DATETIME instead of BIGINT?
	// First we add the new column, defaulting to null
	mg.AddMigration("add last_executed_at column", NewAddColumnMigration(queryHistoryV1, &Column{
		Name: "last_executed_at", Type: DB_BigInt, Nullable: true,
	}))

	// Then we update the column to set the default value
	mg.AddMigration("add default data", NewRawSQLMigration("UPDATE query_history set last_executed_at = created_at WHERE last_executed_at IS NULL;"))

	// Finally, make last_executed_at not nullable. This cannot be done for SQLite.
	mg.AddMigration("make last_executed_at not nullable", NewRawSQLMigration("").
		Mysql("ALTER TABLE query_history CHANGE last_executed_at last_executed_at DATETIME NOT NULL;").
		Postgres("ALTER TABLE query_history ALTER COLUMN query_history SET NOT NULL;"),
	)
}
