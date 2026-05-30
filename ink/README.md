### install

```
pipx install ink
```


### develop

right now: activate venv, then install inside the project root:


```bash
source ./venv/bin/activate
pip install -r requirements.txt
pip3 install -e .

```

Data are stored in `/Users/USER_NAME/ink_log/log.jsonl`


### TODO
 - user customization options: 
    - preserve whitespaces
    - apply styling to editor
 - what kind of NLP methods might help writer write in real time?
    - translate?
    - rephrase/expand or contract sentences
    - word suggestions
    - ...
 - want the editor to respond more actively;
    - maybe some more poetic gestures 
