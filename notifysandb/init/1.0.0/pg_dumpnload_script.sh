
# export from test
/usr/pgsql-10/bin/pg_dump -s -h tst-ecosis-vdb01.ecosis.csi.it -n unpadmin -U unpaudit -f notificatoredb-unpaudit.sql NOTIFICATOREDB
/usr/pgsql-10/bin/pg_dump -s -h tst-ecosis-vdb01.ecosis.csi.it -n unpaudit -U unpaudit -f notificatoredb-unpaudit.sql NOTIFICATOREDB
/usr/pgsql-10/bin/pg_dump -s -h tst-ecosis-vdb01.ecosis.csi.it -n unpevents -U unpevents -f notificatoredb-unpevents.sql NOTIFICATOREDB
/usr/pgsql-10/bin/pg_dump -s -h tst-ecosis-vdb01.ecosis.csi.it -n unpmex -U unpmex -f notificatoredb-unpmex.sql NOTIFICATOREDB
/usr/pgsql-10/bin/pg_dump -s -h tst-ecosis-vdb01.ecosis.csi.it -n unppreferences -U unppreferences -f notificatoredb-unppreferences.sql NOTIFICATOREDB
/usr/pgsql-10/bin/pg_dump -s -h tst-ecosis-vdb01.ecosis.csi.it -n ioit -U ioit -f notificatoredb-ioit.sql NOTIFICATOREDB


# restore i dev
/usr/pgsql-10/bin/psql -h tst-ecosis-vdb01.ecosis.csi.it -U ioit NOTIFICATOREDB_DEV < notificatoredb-ioit.sql
/usr/pgsql-10/bin/psql -h tst-ecosis-vdb01.ecosis.csi.it -U unppreferences NOTIFICATOREDB_DEV < notificatoredb-unppreferences.sql
/usr/pgsql-10/bin/psql -h tst-ecosis-vdb01.ecosis.csi.it -U unpmex NOTIFICATOREDB_DEV < notificatoredb-unpmex.sql
/usr/pgsql-10/bin/psql -h tst-ecosis-vdb01.ecosis.csi.it -U unpevents NOTIFICATOREDB_DEV < notificatoredb-unpevents.sql
/usr/pgsql-10/bin/psql -h tst-ecosis-vdb01.ecosis.csi.it -U unpaudit NOTIFICATOREDB_DEV < notificatoredb-unpaudit.sql
/usr/pgsql-10/bin/psql -h tst-ecosis-vdb01.ecosis.csi.it -U unpadmin NOTIFICATOREDB_DEV < notificatoredb-unpadmin.sql