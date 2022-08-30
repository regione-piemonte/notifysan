{
        level=$2
        element=$3
        if(cambiato[element]==null)
        {
                cambiato[element]=1
                stato[element]=level
                ignora[element]=0
                row[element]=$0
        }
        else
        {
                if(stato[element]!=level && ignora[element]==0) print row[element]
                ignora[element] = 1;
        }
}
BEGIN {
   print "From:" hostname
   print "Subject:Report da " hostname
   print
}

END {
   print "."
}