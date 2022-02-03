#!/bin/bash
if [ "$1" == "chromium" ];then 
    num="1"
elif [ "$1" == "firefox" ];then      
    num="2"
elif [ "$1" == "" ];then
    echo "Auto build script for extension <Download with Aria2>"
    echo 1. Chromium
    echo 2. Firefox
    echo -n "Build for "
    read num
else
   echo "input error,end execution"
   exit
fi
script_dir=$(cd $(dirname ${BASH_SOURCE[0]}); pwd)
if [ "$num" == "1" ];then
    code="chromium"
elif [ "$num" == "2" ];then
   code="firefox"
else
   echo "input error,end execution"
   exit
fi 
echo "$code"
build_dir="$script_dir/build/$code"
if [ ! -d "$build_dir" ]; then
        mkdir -p $build_dir
fi
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
zipPath=$build_dir/$zipFileName
if [  -f "$zipPath" ]; then
        rm -f $zipPath
fi
if [ $num == "2" ];then
   cd ./chromium/
   zip  -r $zipPath ./*
   cd ../
   sleep 3
fi
cd ./${code}/
zip  -r $zipPath ./*
sleep 3
echo "the end"
