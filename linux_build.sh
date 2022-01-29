#!/bin/bash
echo "Auto build script for extension <Download with Aria2>"
echo 1. Chromium
echo 2. Firefox
echo -n "Build for "
read num 
if [ "$num" == "1" ];then
    code="Chromium"
elif [ "$num" == "2" ];then
   code="Firefox"
else
   echo "input error,end execution"
   exit
fi 
echo "$code"
if ! command -v zip >/dev/null 2>&1; then 
  echo "NOT EXIST zip,exit" 
   exit
fi
findContent="version"
versionFlag=0
version=""
for rows in  `cat $code/manifest.json`
do
  if [ $versionFlag == "1" ];then
      version=$rows
      break
  fi
  if [[ $rows == *$findContent* ]];then
     versionFlag=`expr $versionFlag + 1`
     continue
  fi
done
version=${version:1}
verLen=${#version}
verEnd=`expr $verLen - 3`
version=${version:0:verEnd}
zipFileName="$version.zip"
if [ $num == "2" ];then
   cd ./Chromium/
   zip  -r ../$code/$zipFileName ./*
   cd ../
   sleep 3
fi
cd ./${code}/
zip  -r $zipFileName ./*
sleep 3
echo "the end"
