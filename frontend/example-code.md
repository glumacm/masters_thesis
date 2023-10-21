How to make hook for updating object in dexie
```
this.testDB.table('SyncDB_object_name128').hook('updating', (primKEy, obj) => {
      console_log_with_style(
        'Here we have changes for table (SyncDB_object_name128)',
        CONSOLE_STYLE.white_and_black!,
        obj
      );
    });
```