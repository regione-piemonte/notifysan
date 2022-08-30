/*
CREATE OR REPLACE FUNCTION insert_messages2() RETURNS trigger AS $emp_stamp$
    BEGIN
        insert into messages2 values (new.*);
        RETURN NEW;
    END;
$emp_stamp$ LANGUAGE plpgsql;

CREATE TRIGGER bck_insert_messages AFTER  INSERT
    ON messages
    FOR EACH ROW
    EXECUTE PROCEDURE insert_messages2 ( );

CREATE OR REPLACE FUNCTION update_messages2() RETURNS trigger AS $emp_stamp$
    BEGIN
        delete from messages2 where id = NEW.id;
        INSERT INTO messages2 values(NEW.*);
        RETURN NEW;
    END;
$emp_stamp$ LANGUAGE plpgsql;

CREATE TRIGGER bck_update_messages AFTER  UPDATE
    ON messages
    FOR EACH ROW
    EXECUTE PROCEDURE update_messages2 ( );
*/