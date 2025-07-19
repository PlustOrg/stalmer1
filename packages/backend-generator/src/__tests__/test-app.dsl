
entity User {
  name: String
  email: String unique
}

entity Post {
  title: String
  content: Text
  published: Boolean default(false)
  author: User @relation(name: "UserPosts")
}

page Users {
  type: table
  entity: User
  columns: [
    { field: "name", label: "Name" },
    { field: "email", label: "Email" }
  ]
}

page UserForm {
  type: form
  entity: User
}

page Posts {
    type: table
    entity: Post
    permissions: ["admin", "editor"]
}

config {
    db: postgresql
    auth {
        provider: jwt
        userEntity: User
    }
}
